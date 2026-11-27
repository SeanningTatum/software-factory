import { existsSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import {
  addBlock,
  type EnvName,
  loadManifests,
  readProject,
  removeBlock,
  WRANGLER_FILE,
} from "@seanningtatum/software-factory-blocks";
import pc from "picocolors";
import {
  type Cli,
  DEPLOY_SECRET,
  DEPLOY_SWITCH,
  hasSecret,
  keepPlaceholders,
  readRulesets,
  requireGh,
  setUrlVariables,
  setupGithub,
} from "./github.ts";
import { harnessStatus, syncHarness } from "./harness.ts";
import { harnessDir, templateDir } from "./paths.ts";
import { detectPackageManager, type PackageManager, runCommand } from "./pm.ts";
import { capture, gitIdentity, projectWrangler } from "./run.ts";
import { namespaceIds, parseFeatures, uniqueNamespaceIds } from "./scaffold.ts";
import {
  accountId,
  appUrl,
  domainStep,
  firstDeploy,
  type Item,
  isLoggedIn,
  isReady,
  isStagingTip,
  migrate,
  needsUrl,
  provision,
  type RunScript,
  readiness,
  setupEnvs,
} from "./setup.ts";
import { resetHistory, today } from "./timeline.ts";
import { VERSION } from "./version.ts";
import { cancelled } from "./wizard.ts";

/** One issue per manual setup step; the title is its identity, so keep it stable. */
export const setupIssues = (root: string) =>
  [...loadManifests(root).values()].flatMap((m) =>
    (m.setup ?? []).map((step) => ({
      title: `${m.title} setup: ${step.id}`,
      body: `${keepPlaceholders(step.description)}\n${step.help ? `\n${step.help}\n` : ""}\nNo command can do or check this step. Close this issue when it is done.`,
    })),
  );

/** Runs a package script in the project with its output captured, for steps that read it. */
export const runScript =
  (pm: PackageManager, cwd: string): RunScript =>
  (script) => {
    const [cmd, args] = runCommand(pm, script);
    return capture(cmd, cwd)(args);
  };

/** Asks for an environment's URL; empty keeps its workers.dev address. */
export const askUrl = async (env: EnvName) =>
  cancelled(
    await p.text({
      message: `URL of ${env}, if it has its own domain (leave empty to use its workers.dev address)`,
      defaultValue: "",
      validate: (v) => (!v || /^https:\/\/\S+$/.test(v) ? undefined : "Start with https://"),
    }),
  ).trim() || undefined;

/** The closing note: `steps`, then the move to a domain while production is on workers.dev. */
export const printNext = (root: string, steps: ReadonlyArray<string>, pm: PackageManager) => {
  const domain = domainStep(root, moveCommand(pm));
  const lines = [...steps, ...(domain ? ["", domain] : [])];
  if (lines.length) p.note(lines.join("\n"), "Next");
};

/** The command that moves production to its own domain, for the closing note. */
const moveCommand = (pm: PackageManager) =>
  runCommand(pm, "setup", "--env", "production", "--var", "APP_URL=https://your-domain")
    .flat()
    .join(" ");

export const GITHUB = "create-software-factory github";

/** Feature names from the command line (`kv workflows` or `kv,workflows`), old block names mapped and noted. */
const featureArgs = (args: ReadonlyArray<string>) => {
  const { features, notes } = parseFeatures(args.flatMap((arg) => arg.split(",")));
  for (const note of notes) console.log(note);
  if (!features.length) throw new Error("Name a feature.");
  return features;
};

export const add = (...names: ReadonlyArray<string>) => {
  const features = featureArgs(names);
  const root = process.cwd();
  readProject(root);
  // Checked before the first one is copied, so a mistyped name leaves nothing half added.
  const known = loadManifests(templateDir());
  const unknown = features.filter((f) => !known.has(f));
  if (unknown.length) throw new Error(`Unknown feature(s): ${unknown.join(", ")}`);
  const git = capture("git", root);
  const before = git(["status", "--porcelain"]);
  const hooked = existsSync(join(root, ".husky/pre-commit"));
  const ids = namespaceIds(root);
  const added = features.flatMap((f) => addBlock(root, templateDir(), f));
  // A new limiter arrives with its manifest's id, the same in every project; see `create`.
  uniqueNamespaceIds(root, ids);
  resetHistory(root, added, `- ${today()} — Added with create-software-factory ${VERSION}.`);
  if (!added.length) {
    console.log(`Already on: ${features.join(", ")}.`);
    return;
  }
  // A feature is far over the size hook's limit, and none of it is the owner's writing. From a
  // clean tree the commit holds the scaffolding and nothing else, so it alone may skip the hook.
  const clean = before.ok && !before.stdout.trim();
  if (hooked && clean) commitScaffold(root, git, added);
  console.log(
    `Added ${added.join(", ")}${hooked && clean ? ", in a commit of its own" : ""}. Install packages, then run db:generate <name> (say, add_${added[0]}) if a feature has tables.`,
  );
  if (hooked && !clean)
    console.log(
      "Not committed: other work was uncommitted. The size hook counts this scaffolding, so commit it in steps; from a clean tree, `add` commits it for you.",
    );
};

const commitScaffold = (root: string, git: Cli, added: ReadonlyArray<string>) => {
  const message = `feat(scaffold): add ${added.join(", ")} with create-software-factory ${VERSION}`;
  for (const args of [
    ["add", "-A"],
    [...gitIdentity(root), "commit", "--quiet", "--no-verify", "-m", message],
  ]) {
    const result = git(args);
    if (!result.ok) throw new Error(`git ${args[0]} failed:\n${result.stderr.trim()}`);
  }
};

export const remove = (names: ReadonlyArray<string>, force = false) => {
  const features = featureArgs(names);
  const root = process.cwd();
  readProject(root);
  for (const feature of features) removeBlock(root, feature, { force });
  console.log(
    `Removed ${features.join(", ")}. Install packages to drop the ones it used. If it had tables, the next db:generate writes DROP TABLE for them: read that migration before you apply it.`,
  );
};

const ICON: Record<Item["state"], string> = {
  set: pc.green("✓"),
  missing: pc.red("✗"),
  unknown: pc.yellow("?"),
  manual: pc.blue("•"),
};

export const printTable = (items: ReadonlyArray<Item>) => {
  for (const item of items) {
    const need = item.required ? "" : pc.dim(" (optional)");
    const fix = item.state === "set" ? "" : pc.dim(`  → ${item.fix}`);
    console.log(`${ICON[item.state]} ${item.env.padEnd(10)} ${item.name}${need}${fix}`);
  }
};

export interface SetupArgs {
  readonly check: boolean;
  readonly env: string | undefined;
  readonly vars: ReadonlyArray<string>;
  readonly yes: boolean;
}

export const setup = async (args: SetupArgs) => {
  const root = process.cwd();
  readProject(root);
  const wrangler = projectWrangler(root);
  const loggedIn = isLoggedIn(wrangler);
  if (args.check) {
    const items = readiness(root, loggedIn ? wrangler : undefined);
    printTable(items);
    if (!loggedIn) console.log(pc.dim("\nRun `wrangler login` to check secrets too."));
    process.exitCode = isReady(items) ? 0 : 1;
    return;
  }
  const vars = Object.fromEntries(
    args.vars.map((pair) => [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)]),
  );
  const secrets = [...loadManifests(root).values()].flatMap((m) => Object.keys(m.secrets ?? {}));
  // A --var lands in wrangler.jsonc, which is committed.
  const secretVars = Object.keys(vars).filter((key) => secrets.includes(key));
  if (secretVars.length)
    throw new Error(
      `${secretVars.join(", ")} ${secretVars.length > 1 ? "are secrets" : "is a secret"}, and a --var is written to ${WRANGLER_FILE}. Set it in your shell or type it when setup asks.`,
    );
  const fromEnv = secrets.filter((key) => process.env[key]);
  const envs = setupEnvs(args.env, [...Object.keys(vars).map((k) => `--var ${k}`), ...fromEnv]);
  if (!loggedIn) throw new Error("Log in first: npx wrangler login");
  p.intro(pc.inverse(" setup "));
  migrate(root, wrangler, "local", (line) => p.log.step(line));
  // A URL is given with --env, so it belongs to the one environment named.
  const { APP_URL: url, ...rest } = vars;
  const urls = await setupUrls(root, envs, url, !args.yes && process.stdin.isTTY);
  await provision(root, wrangler, {
    envs,
    vars: rest,
    secretValue: async (key, env, isSet) => {
      const value = process.env[key];
      if (value) return value;
      if (args.yes || isSet || key === "BETTER_AUTH_SECRET") return undefined;
      const typed = cancelled(
        await p.password({ message: `${key} for ${env} (leave empty to skip)` }),
      );
      return typed || undefined;
    },
    log: (line) => p.log.step(line),
  });
  const pm = detectPackageManager();
  const recorded = firstDeploy(
    root,
    envs,
    runScript(pm, root),
    (line) => p.log.step(line),
    urls,
    isStagingTip(root),
  );
  const changed = Object.keys(recorded).length > 0;
  if (changed) setGithubUrls(root, recorded);
  p.log.info("Where things stand:");
  printTable(readiness(root, wrangler));
  printNext(root, [], pm);
  p.outro(
    changed
      ? `${WRANGLER_FILE} now holds each new APP_URL. Commit it and merge it into staging before the next promotion: CI deploys what staging holds.`
      : "Run setup again any time; it only adds what is missing.",
  );
};

/**
 * Each environment's URL for this run: the one `--var APP_URL` gave, else, at a terminal, one
 * asked for while the environment has none or is on workers.dev.
 */
const setupUrls = async (
  root: string,
  envs: ReadonlyArray<EnvName>,
  given: string | undefined,
  canAsk: boolean,
) => {
  const urls: Partial<Record<EnvName, string>> = given && envs[0] ? { [envs[0]]: given } : {};
  if (!canAsk) return urls;
  for (const env of envs) {
    if (urls[env] || !needsUrl(root, env)) continue;
    const asked = await askUrl(env);
    if (asked) urls[env] = asked;
  }
  return urls;
};

/** Gives GitHub the URLs setup just recorded, when the project has a repository there. */
const setGithubUrls = (root: string, urls: Partial<Record<EnvName, string>>) => {
  if (!capture("git", root)(["remote", "get-url", "origin"]).ok) return;
  const gh = capture("gh", root);
  try {
    requireGh(gh);
    setUrlVariables(gh, urls, (line) => p.log.step(line));
  } catch (error) {
    p.log.warn(`${(error as Error).message}\nRun \`${GITHUB}\` to update GitHub's URL variables.`);
  }
};

/** How to supply each setting deploy.yml needs, for the ones `github` could not work out. */
const DEPLOY_FIX: Readonly<Record<string, string>> = {
  [DEPLOY_SWITCH]:
    "held back until the staging URL and the token are set, because it switches the deploys on. If it is the only one listed, run `wrangler login` or set it in your shell",
  STAGING_URL: "run `setup --env staging --var APP_URL=https://...`",
  PRODUCTION_URL: "run `setup --env production --var APP_URL=https://...`",
  [DEPLOY_SECRET]: "run `gh secret set CLOUDFLARE_API_TOKEN`",
};

/**
 * What deploy.yml needs from this machine: the Cloudflare account, the two URLs and the token. The
 * URLs are each environment's APP_URL, because /api/health refuses any other. Nothing is guessed.
 */
export const deployInputs = async (root: string, gh: Cli, hasRepository: boolean) => {
  if (!existsSync(join(root, WRANGLER_FILE))) return undefined; // not made from the template
  const variables = {
    [DEPLOY_SWITCH]: process.env.CLOUDFLARE_ACCOUNT_ID || accountId(projectWrangler(root)),
    STAGING_URL: appUrl(root, "staging"),
    PRODUCTION_URL: appUrl(root, "production"),
  };
  // Asked for, never taken from the shell: a token there may be wider than CI should hold.
  const token =
    (hasRepository && hasSecret(gh, DEPLOY_SECRET)) || !process.stdin.isTTY
      ? undefined
      : cancelled(
          await p.password({
            message: `Cloudflare API token for GitHub Actions to deploy with (${DEPLOY_SECRET}; leave empty to skip)`,
          }),
        ) || undefined;
  return { variables, token };
};

/** Names what deploy.yml still lacks and how to supply each; until then its jobs skip. */
export const printMissing = (missing: ReadonlyArray<string>) => {
  if (!missing.length) return;
  console.log(
    pc.yellow("\nGitHub Actions can't deploy until these are set. Then run `github` again:"),
  );
  for (const name of missing) console.log(`  ${name}: ${DEPLOY_FIX[name]}`);
};

export const github = async (isPublic: boolean) => {
  const root = process.cwd();
  const gh = capture("gh", root);
  const git = capture("git", root);
  // Both before the token question, so a typed token is never thrown away.
  readRulesets(root);
  requireGh(gh);
  const missing = setupGithub(root, gh, git, {
    name: () => readProject(root).name,
    visibility: isPublic ? "public" : "private",
    deploy: await deployInputs(root, gh, git(["remote", "get-url", "origin"]).ok),
    // Not made from the template: no feature manifests, so no steps.
    issues: existsSync(join(root, WRANGLER_FILE)) ? setupIssues(root) : [],
    log: console.log,
  });
  printMissing(missing);
  console.log(
    "\nTo ship: git fetch origin && git push --atomic origin origin/staging:refs/tags/v0.1.0 origin/staging:refs/heads/production (docs/branches.md says why).",
  );
};

export const harness = (action: string, force: boolean) => {
  const root = process.cwd();
  if (action !== "check" && action !== "sync")
    throw new Error(`Unknown action "${action}". Use check or sync.`);
  if (action === "check") {
    const { changed, missing } = harnessStatus(root);
    for (const f of changed) console.log(`${pc.yellow("changed")} .claude/${f}`);
    for (const f of missing) console.log(`${pc.red("missing")} .claude/${f}`);
    if (!changed.length && !missing.length) console.log("The harness matches harness.lock.json.");
    if (changed.length || missing.length) process.exitCode = 1;
    return;
  }
  const { updated, kept } = syncHarness(harnessDir(), root, force);
  console.log(
    `Updated ${updated.length} file(s).${kept.length ? ` Kept your edits to ${kept.join(", ")} (use --force to replace).` : ""}`,
  );
};
