import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Wrangler } from "./setup.ts";

/** Runs `gh` or `git` in the project: the same shape as Wrangler, with stdin for request bodies. */
export type Cli = Wrangler;

export class GithubError extends Error {}

/** One file per ruleset, in GitHub's own import format, so Settings → Rules can load them too. */
export const RULESETS_DIR = ".github/rulesets";
const RULESETS_API = "repos/{owner}/{repo}/rulesets";

export interface GithubOptions {
  /** The repository's name, read only when there is no `origin` yet and one is created. */
  readonly name: () => string;
  readonly visibility: "private" | "public";
  /** What deploy.yml reads; set before the first push so that push can deploy staging. */
  readonly deploy?: {
    readonly variables: Readonly<Record<string, string | undefined>>;
    readonly token: string | undefined;
  };
  readonly log: (line: string) => void;
}

const must = (result: ReturnType<Cli>, what: string) => {
  if (!result.ok)
    throw new GithubError(`${what} failed:\n${(result.stderr || result.stdout).trim()}`);
  return result.stdout;
};

interface Ruleset {
  readonly name: string;
  readonly body: string;
}

/** The rulesets in `.github/rulesets/`, read and parsed before anything on GitHub changes. */
const readRulesets = (root: string): ReadonlyArray<Ruleset> => {
  const dir = join(root, RULESETS_DIR);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
  if (!files.length) throw new GithubError(`No rulesets in ${RULESETS_DIR}.`);
  return files.sort().map((file) => {
    const body = readFileSync(join(dir, file), "utf8");
    const name = (() => {
      try {
        return (JSON.parse(body) as { name?: unknown }).name;
      } catch {
        return undefined;
      }
    })();
    if (typeof name !== "string")
      throw new GithubError(`${RULESETS_DIR}/${file} is not a ruleset: it needs JSON with a name.`);
    return { name, body };
  });
};

/** Creates each ruleset, or replaces the one of the same name. */
const applyRulesets = (rulesets: ReadonlyArray<Ruleset>, gh: Cli, log: (line: string) => void) => {
  // Without includes_parents=false an organization's ruleset of the same name would match.
  const existing = JSON.parse(
    must(gh(["api", `${RULESETS_API}?includes_parents=false`]), "Listing rulesets"),
  ) as Array<{ id: number; name: string }>;
  for (const { name, body } of rulesets) {
    const id = existing.find((r) => r.name === name)?.id;
    const [method, path] =
      id === undefined ? ["POST", RULESETS_API] : ["PUT", `${RULESETS_API}/${id}`];
    must(gh(["api", "--method", method, path, "--input", "-"], body), `Ruleset ${name}`);
    log(`ruleset ${name}: ${id === undefined ? "created" : "updated"}`);
  }
};

/** Stops unless gh is installed and signed in. Call it before asking for anything gh will need. */
export const requireGh = (gh: Cli) => {
  const auth = gh(["auth", "status"]);
  if (!auth.ok)
    throw new GithubError(
      // gh's own words follow: a stale login on another host fails this too.
      `The GitHub CLI is not ready. Install it (https://cli.github.com) and run \`gh auth login\`.\n${auth.stderr.trim()}`.trim(),
    );
};

/** The repository secret deploy.yml reads; the variables beside it are not secret. */
export const DEPLOY_SECRET = "CLOUDFLARE_API_TOKEN";
/** The variable that switches deploy.yml on: its jobs skip until it is set. */
export const DEPLOY_SWITCH = "CLOUDFLARE_ACCOUNT_ID";

/** Whether the repository has the secret. GitHub lists names only; a value can't be read back. */
export const hasSecret = (gh: Cli, name: string) => {
  const listed = gh(["secret", "list", "--json", "name"]);
  return (
    listed.ok && (JSON.parse(listed.stdout) as Array<{ name: string }>).some((s) => s.name === name)
  );
};

/**
 * Gives GitHub Actions what deploy.yml needs: each repository variable that has a value, and the
 * Cloudflare token when one is given. The token goes to gh on stdin, never as an argument.
 * The switch is held back until staging has its URL and the token, so the first deploy to run is
 * one that can pass. Returns the names still missing, so the caller can say how to supply each.
 */
export const setDeploySettings = (
  gh: Cli,
  variables: Readonly<Record<string, string | undefined>>,
  token: string | undefined,
  log: (line: string) => void,
): ReadonlyArray<string> => {
  const missing: Array<string> = [];
  const hasToken = Boolean(token) || hasSecret(gh, DEPLOY_SECRET);
  const canDeploy = hasToken && Boolean(variables.STAGING_URL);
  for (const [name, value] of Object.entries(variables)) {
    if (!value || (name === DEPLOY_SWITCH && !canDeploy)) {
      missing.push(name);
      continue;
    }
    must(gh(["variable", "set", name, "--body", value]), `Variable ${name}`);
    log(`variable ${name}: ${value}`);
  }
  if (token) {
    must(gh(["secret", "set", DEPLOY_SECRET], token), `Secret ${DEPLOY_SECRET}`);
    log(`secret ${DEPLOY_SECRET}: set`);
  } else if (!hasToken) missing.push(DEPLOY_SECRET);
  return missing;
};

/**
 * Puts the project on GitHub with its branch model: `staging` is the default branch, `production`
 * starts as a copy of it, and each gets the ruleset in `.github/rulesets/`. Safe to run again: a
 * repository, branch or ruleset that exists is kept or updated, never made twice. Returns the names
 * of the deploy settings it was not given.
 */
export const setupGithub = (root: string, gh: Cli, git: Cli, options: GithubOptions) => {
  const rulesets = readRulesets(root);
  requireGh(gh);
  const needLocalStaging = () => {
    if (!git(["rev-parse", "--verify", "--quiet", "refs/heads/staging"]).ok)
      throw new GithubError(
        "No local staging branch. Commit first, and rename your main branch: git branch -m staging",
      );
  };
  if (!git(["remote", "get-url", "origin"]).ok) {
    needLocalStaging();
    const name = options.name();
    must(
      gh([
        "repo",
        "create",
        name,
        `--${options.visibility}`,
        "--source",
        ".",
        "--remote",
        "origin",
      ]),
      "gh repo create",
    );
    options.log(`repository ${name}: created (${options.visibility})`);
  }
  const missing = options.deploy
    ? setDeploySettings(gh, options.deploy.variables, options.deploy.token, options.log)
    : [];
  const heads = must(git(["ls-remote", "--heads", "origin"]), "git ls-remote");
  const onRemote = (branch: string) => new RegExp(`refs/heads/${branch}$`, "m").test(heads);
  if (!onRemote("staging")) {
    // Pushing a second branch would leave the old default behind, unprotected.
    if (heads.trim())
      throw new GithubError(
        "The repository has branches but no staging. Rename its default branch to staging on GitHub (Settings → Branches), then run this again.",
      );
    needLocalStaging();
    must(git(["push", "--set-upstream", "origin", "staging"]), "git push staging");
    options.log("branch staging: pushed");
  }
  if (!onRemote("production")) {
    must(git(["fetch", "origin", "staging"]), "git fetch staging");
    must(git(["push", "origin", "FETCH_HEAD:refs/heads/production"]), "git push production");
    options.log("branch production: created from staging");
  }
  must(
    gh(["api", "--method", "PATCH", "repos/{owner}/{repo}", "-f", "default_branch=staging"]),
    "Setting the default branch",
  );
  options.log("default branch: staging");
  applyRulesets(rulesets, gh, options.log);
  return missing;
};
