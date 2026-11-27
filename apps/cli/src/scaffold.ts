import { randomBytes, randomInt } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  type BlockManifest,
  envNames,
  loadManifests,
  prune,
  readProject,
  sync,
  WRANGLER_FILE,
  writeProject,
} from "@software-factory/blocks";
import { applyEdits, modify, parse } from "jsonc-parser";
import { installHarness } from "./harness.ts";
import { GENERATED_SECRETS, SECRET_BYTES, withVars } from "./setup.ts";
import { resetHistory, today } from "./timeline.ts";
import { VERSION } from "./version.ts";

export interface ScaffoldOptions {
  readonly templateDir: string;
  readonly harnessDir: string | undefined;
  /** The commit hooks to add; undefined leaves husky out. */
  readonly huskyDir?: string | undefined;
  /** False leaves out the GitHub workflows, the rulesets and the doc that draws them. */
  readonly github?: boolean;
  readonly targetDir: string;
  readonly name: string;
  /** Optional features and core modules to keep; required ones are always kept. */
  readonly features: ReadonlyArray<string>;
  /** The date on each TIMELINE.md's History line; today by default. */
  readonly date?: string;
  /** Values written into .dev.vars, such as the Stripe keys asked for during `create`. */
  readonly devVars?: Readonly<Record<string, string>>;
  /** The package manager the project will use. The template's Bun pin is kept only for Bun. */
  readonly pm?: string;
}

export interface BlankSetting {
  readonly key: string;
  readonly feature: string;
  readonly description: string;
  readonly help: string | undefined;
  readonly secret: boolean;
}

/**
 * Required vars and secrets of these features (and the required ones) that have no default, so the
 * feature stays off until someone fills them in. BETTER_AUTH_SECRET is left out: it is generated.
 */
export const blankSettings = (
  templateDir: string,
  features: ReadonlyArray<string>,
): ReadonlyArray<BlankSetting> =>
  [...loadManifests(templateDir).values()]
    .filter((m) => m.required || features.includes(m.name))
    .flatMap((m) =>
      [
        ...Object.entries(m.vars ?? {}).map(([key, spec]) => ({ key, spec, secret: false })),
        ...Object.entries(m.secrets ?? {}).map(([key, spec]) => ({ key, spec, secret: true })),
      ]
        .filter(({ key, spec }) => spec.required && !spec.default && !GENERATED_SECRETS.has(key))
        .map(({ key, spec, secret }) => ({
          key,
          feature: m.title,
          description: spec.description,
          help: spec.help,
          secret,
        })),
    );

export interface ScaffoldResult {
  /** The optional features kept, with what they require. */
  readonly features: ReadonlyArray<string>;
}

/** Old block names, still accepted. */
/**
 * One line per `auto` feature the choice half covers, such as auth without email: what is left
 * out, and what to add to get it.
 */
export const missedAuto = (
  manifests: ReadonlyMap<string, BlockManifest>,
  features: ReadonlyArray<string>,
): ReadonlyArray<string> =>
  [...manifests.values()]
    .filter((m) => m.auto && !features.includes(m.name))
    .filter((m) => m.requires.some((r) => features.includes(r)))
    .map((m) => {
      const have = m.requires.filter((r) => features.includes(r)).join(", ");
      // An auto requirement can't be chosen; it arrives with what it requires.
      const missing = m.requires
        .filter((r) => !features.includes(r) && !manifests.get(r)?.auto)
        .join(", ");
      return `${have} without ${missing} leaves out "${m.title}": ${m.description} Choose ${missing} too, or run \`add ${missing}\` later.`;
    });

export const FEATURE_ALIASES: Readonly<Record<string, string>> = { d1: "db", r2: "uploads" };

/** Splits a comma-separated list and maps old block names to feature names. */
export const parseFeatures = (list: string | ReadonlyArray<string>) => {
  const names = typeof list === "string" ? list.split(",") : list;
  const notes: Array<string> = [];
  const features = names
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => {
      const renamed = FEATURE_ALIASES[n];
      if (!renamed) return n;
      notes.push(`"${n}" is now called "${renamed}".`);
      return renamed;
    });
  return { features: [...new Set(features)], notes };
};

/**
 * R2 bucket names stop at 63 characters, and the longest name made from the project is
 * `{project}-uploads-staging`, 16 more.
 */
export const MAX_NAME = 63 - "-uploads-staging".length;
const NAME = new RegExp(`^[a-z0-9](?:[a-z0-9-]{0,${MAX_NAME - 2}}[a-z0-9])?$`);

/** Cloudflare and npm both accept this: lowercase letters, digits and dashes. */
export const validateName = (name: string): string | undefined =>
  NAME.test(name)
    ? undefined
    : `Use lowercase letters, digits and dashes, starting and ending with a letter or digit (e.g. my-app), ${MAX_NAME} characters at most.`;

/** A project name from its folder: `My App` and `./my-app/` give `my-app`. */
export const nameFromDir = (dir: string) =>
  basename(resolve(dir))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_NAME)
    .replace(/^-|-$/g, "") || "my-saas";

export const titleCase = (name: string) =>
  name
    .split("-")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");

export const isEmptyDir = (dir: string) => !existsSync(dir) || readdirSync(dir).length === 0;

/** Whether any feature or core module defines tables, so there is a migration to generate. */
export const hasTables = (dir: string) =>
  [...loadManifests(dir).values()].some((m) => existsSync(join(dir, m.dir, "schema.ts")));

const edit = (path: string, fn: (text: string) => string) =>
  writeFileSync(path, fn(readFileSync(path, "utf8")));

/** Sets the project's name everywhere the template uses "saas-starter". */
const rename = (dir: string, name: string) => {
  edit(join(dir, "package.json"), (text) => {
    const pkg = JSON.parse(text);
    pkg.name = name;
    return `${JSON.stringify(pkg, null, 2)}\n`;
  });
  edit(join(dir, "wrangler.jsonc"), (text) => applyEdits(text, modify(text, ["name"], name, {})));
  writeProject(dir, { ...readProject(dir), name });
  edit(join(dir, "src/app/constants.ts"), (text) =>
    text.replace(
      'export const APP_NAME = "SaaS Starter";',
      `export const APP_NAME = ${JSON.stringify(titleCase(name))};`,
    ),
  );
  edit(join(dir, "README.md"), (text) => text.replace(/^# .*$/m, `# ${titleCase(name)}`));
};

const LIMITER_SCOPES = [[], ["env", "staging"]];

/** Every rate-limit namespace id in wrangler.jsonc, production's and staging's. */
export const namespaceIds = (dir: string): ReadonlySet<string> => {
  const json = parse(readFileSync(join(dir, "wrangler.jsonc"), "utf8"));
  const limiters = LIMITER_SCOPES.flatMap((path) => at(json, path)?.ratelimits ?? []);
  return new Set(limiters.map((l) => (l as { namespace_id: string }).namespace_id));
};

/**
 * Rate-limit namespace ids are account-wide on Cloudflare, so two projects with the manifests'
 * ids would share counters. Gives every limiter, in production and staging, its own random id,
 * except those in `keep`: the ids a project had before `add`, which its deployed limiters use.
 */
export const uniqueNamespaceIds = (dir: string, keep: ReadonlySet<string> = new Set()) =>
  edit(join(dir, "wrangler.jsonc"), (text) => {
    const used = new Set(keep);
    let out = text;
    for (const path of LIMITER_SCOPES) {
      const limiters = at(parse(out), path)?.ratelimits ?? [];
      for (let i = 0; i < limiters.length; i++) {
        if (keep.has((limiters[i] as { namespace_id: string }).namespace_id)) continue;
        let id = String(randomInt(1_000_000, 2 ** 31));
        while (used.has(id)) id = String(randomInt(1_000_000, 2 ** 31));
        used.add(id);
        out = applyEdits(out, modify(out, [...path, "ratelimits", i, "namespace_id"], id, {}));
      }
    }
    return out;
  });

const at = (value: unknown, path: ReadonlyArray<string>): { ratelimits?: Array<unknown> } => {
  let cursor = value as Record<string, unknown> | undefined;
  for (const key of path) cursor = cursor?.[key] as Record<string, unknown> | undefined;
  return (cursor ?? {}) as { ratelimits?: Array<unknown> };
};

/** A .dev.vars ready for `dev`: the example, with a fresh auth secret and the values given. */
const writeDevVars = (dir: string, values: Readonly<Record<string, string>>) => {
  const example = join(dir, ".dev.vars.example");
  if (!existsSync(example)) return;
  const filled: Readonly<Record<string, string>> = {
    BETTER_AUTH_SECRET: randomBytes(SECRET_BYTES).toString("base64url"),
    ...values,
  };
  writeFileSync(
    join(dir, ".dev.vars"),
    readFileSync(example, "utf8").replace(/^([A-Z0-9_]+)=[^\r\n]*$/gm, (line, key: string) => {
      const value = filled[key];
      // One line per value: a newline would start a new variable.
      return value && !/[\r\n]/.test(value) ? `${key}=${value}` : line;
    }),
  );
};

const usePosthog = (dir: string, values: Readonly<Record<string, string>>) => {
  const { POSTHOG_KEY, POSTHOG_HOST } = values;
  if (!POSTHOG_KEY) return;
  const vars = { ANALYTICS_PROVIDER: "posthog", ...(POSTHOG_HOST ? { POSTHOG_HOST } : {}) };
  edit(join(dir, WRANGLER_FILE), (text) =>
    envNames.reduce((acc, env) => withVars(acc, env, vars), text),
  );
};

/** The husky a project gets; keep it in step with this repo's own. */
const HUSKY_VERSION = "^9.1.7";

/**
 * Copies the commit hooks and adds husky, which `install` turns on through the `prepare` script.
 * shortcut: Yarn 2 and later never run `prepare`, so there `yarn husky` is a step by hand; move it to `postinstall` if Yarn users ask.
 */
const installHusky = (huskyDir: string, dir: string) => {
  cpSync(huskyDir, join(dir, ".husky"), { recursive: true });
  edit(join(dir, "package.json"), (text) => {
    const pkg = JSON.parse(text);
    pkg.scripts.prepare = "husky";
    pkg.devDependencies = Object.fromEntries(
      Object.entries({ ...pkg.devDependencies, husky: HUSKY_VERSION }).sort(([a], [b]) =>
        a < b ? -1 : 1,
      ),
    );
    return `${JSON.stringify(pkg, null, 2)}\n`;
  });
};

/**
 * What only the GitHub side uses. In the README that is the part between `github` markers, and
 * the line for the `github` command, which has no rulesets to apply.
 */
const GITHUB_FILES = [".github", "docs/branches.md"];
const GITHUB_README =
  /<!-- github:start -->[\s\S]*?<!-- github:end -->\n*|^bunx create-software-factory github .*\n/gm;

/** Takes out the workflows, the rulesets, their doc and the README's words about them. */
const removeGithub = (dir: string) => {
  for (const path of GITHUB_FILES) rmSync(join(dir, path), { recursive: true, force: true });
  edit(join(dir, "README.md"), (text) => text.replace(GITHUB_README, ""));
};

/**
 * Copies the template, keeps the required features and the chosen ones (and what they require), names
 * the project, starts each feature's History, and adds the Claude harness and the commit hooks.
 * Installing packages and generating migrations are left to the caller.
 */
export const scaffold = (options: ScaffoldOptions): ScaffoldResult => {
  const { templateDir, harnessDir, huskyDir, targetDir, name } = options;
  const problem = validateName(name);
  if (problem) throw new Error(problem);
  if (!isEmptyDir(targetDir)) throw new Error(`${targetDir} is not empty.`);

  const available = loadManifests(templateDir);
  const { features } = parseFeatures(options.features);
  const unknown = features.filter((f) => !available.has(f));
  if (unknown.length) {
    throw new Error(
      `Unknown feature(s): ${unknown.join(", ")}. Choose from: ${[...available.values()]
        .filter((m) => !m.required)
        .map((m) => m.name)
        .join(", ")}`,
    );
  }

  mkdirSync(targetDir, { recursive: true });
  cpSync(templateDir, targetDir, { recursive: true });
  renameSync(join(targetDir, "_gitignore"), join(targetDir, ".gitignore"));
  writeProject(targetDir, { ...readProject(targetDir), name });

  const kept = prune(targetDir, features);
  rename(targetDir, name);
  // Corepack refuses to run pnpm or yarn in a project whose packageManager names another one.
  if (options.pm && options.pm !== "bun") {
    edit(join(targetDir, "package.json"), (text) => text.replace(/^ *"packageManager": .*\n/m, ""));
  }
  uniqueNamespaceIds(targetDir);
  sync(targetDir);
  resetHistory(
    targetDir,
    [...loadManifests(targetDir).values()],
    `- ${options.date ?? today()} — Created from create-software-factory ${VERSION}.`,
  );
  writeDevVars(targetDir, options.devVars ?? {});
  usePosthog(targetDir, options.devVars ?? {});

  if (harnessDir && existsSync(harnessDir)) installHarness(harnessDir, targetDir);
  if (huskyDir && existsSync(huskyDir)) installHusky(huskyDir, targetDir);
  if (options.github === false) removeGithub(targetDir);
  return { features: kept };
};
