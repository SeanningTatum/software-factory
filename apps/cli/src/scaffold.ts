import { randomBytes, randomInt } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { loadManifests, prune, readProject, sync, writeProject } from "@tanstack-cf-saas/blocks";
import { applyEdits, modify, parse } from "jsonc-parser";
import { installHarness } from "./harness.ts";
import { GENERATED_SECRETS, SECRET_BYTES } from "./setup.ts";
import { resetHistory, today } from "./timeline.ts";
import { VERSION } from "./version.ts";

export interface ScaffoldOptions {
  readonly templateDir: string;
  readonly harnessDir: string | undefined;
  readonly targetDir: string;
  readonly name: string;
  /** Optional features and core modules to keep; required ones are always kept. */
  readonly features: ReadonlyArray<string>;
  /** The date on each TIMELINE.md's History line; today by default. */
  readonly date?: string;
  /** Values written into .dev.vars, such as the Stripe keys asked for during `create`. */
  readonly devVars?: Readonly<Record<string, string>>;
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
    .replace(/[^a-z0-9-]+/g, "-")
    .slice(0, MAX_NAME)
    .replace(/^-+|-+$/g, "") || "my-saas";

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
  edit(join(dir, "src/routes/__root.tsx"), (text) =>
    text.replace(
      'export const APP_NAME = "SaaS Starter";',
      `export const APP_NAME = ${JSON.stringify(titleCase(name))};`,
    ),
  );
  edit(join(dir, "README.md"), (text) => text.replace(/^# .*$/m, `# ${titleCase(name)}`));
};

/**
 * Rate-limit namespace ids are account-wide on Cloudflare, so two projects with the manifests'
 * ids would share counters. Gives every limiter, in production and staging, its own random id.
 */
const uniqueNamespaceIds = (dir: string) =>
  edit(join(dir, "wrangler.jsonc"), (text) => {
    const used = new Set<number>();
    let out = text;
    for (const path of [[], ["env", "staging"]]) {
      const limiters = at(parse(out), path)?.ratelimits ?? [];
      for (let i = 0; i < limiters.length; i++) {
        let id = randomInt(1_000_000, 2 ** 31);
        while (used.has(id)) id = randomInt(1_000_000, 2 ** 31);
        used.add(id);
        out = applyEdits(
          out,
          modify(out, [...path, "ratelimits", i, "namespace_id"], String(id), {}),
        );
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
    readFileSync(example, "utf8").replace(/^([A-Z0-9_]+)=$/gm, (line, key: string) => {
      const value = filled[key];
      // One line per value: a newline would start a new variable.
      return value && !/[\r\n]/.test(value) ? `${key}=${value}` : line;
    }),
  );
};

/**
 * Copies the template, keeps the required features and the chosen ones (and what they require), names
 * the project, starts each feature's History, and adds the Claude harness. Installing packages and
 * generating migrations are left to the caller.
 */
export const scaffold = (options: ScaffoldOptions): ScaffoldResult => {
  const { templateDir, harnessDir, targetDir, name } = options;
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
  uniqueNamespaceIds(targetDir);
  sync(targetDir);
  resetHistory(
    targetDir,
    [...loadManifests(targetDir).values()],
    `- ${options.date ?? today()} — Created from create-tanstack-cf-saas ${VERSION}.`,
  );
  writeDevVars(targetDir, options.devVars ?? {});

  if (harnessDir && existsSync(harnessDir)) installHarness(harnessDir, targetDir);
  return { features: kept };
};
