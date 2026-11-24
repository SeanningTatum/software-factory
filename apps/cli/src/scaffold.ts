import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadManifests, prune, readProject, sync, writeProject } from "@tanstack-cf-saas/blocks";
import { applyEdits, modify } from "jsonc-parser";
import { installHarness } from "./harness.ts";

export interface ScaffoldOptions {
  readonly templateDir: string;
  readonly harnessDir: string | undefined;
  readonly targetDir: string;
  readonly name: string;
  readonly blocks: ReadonlyArray<string>;
}

export interface ScaffoldResult {
  readonly blocks: ReadonlyArray<string>;
  readonly harness: boolean;
}

const NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;
const SECRET_BYTES = 36;

/** Cloudflare and npm both accept this: lowercase letters, digits and dashes. */
export const validateName = (name: string): string | undefined =>
  NAME.test(name) ? undefined : "Use lowercase letters, digits and dashes (e.g. my-app), 63 characters at most.";

export const titleCase = (name: string) =>
  name
    .split("-")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");

export const isEmptyDir = (dir: string) => !existsSync(dir) || readdirSync(dir).length === 0;

/** Whether any enabled block defines tables, so there is a migration to generate. */
export const hasTables = (dir: string) =>
  existsSync(join(dir, "src/blocks")) &&
  readdirSync(join(dir, "src/blocks")).some((block) => existsSync(join(dir, "src/blocks", block, "schema.ts")));

const edit = (path: string, fn: (text: string) => string) => writeFileSync(path, fn(readFileSync(path, "utf8")));

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
    text.replace('export const APP_NAME = "SaaS Starter";', `export const APP_NAME = ${JSON.stringify(titleCase(name))};`),
  );
  edit(join(dir, "README.md"), (text) => text.replace(/^# .*$/m, `# ${titleCase(name)}`));
};

/** A .dev.vars ready for `dev`: the example, with a fresh auth secret when auth is enabled. */
const writeDevVars = (dir: string) => {
  const example = join(dir, ".dev.vars.example");
  if (!existsSync(example)) return;
  const secret = randomBytes(SECRET_BYTES).toString("base64url");
  writeFileSync(join(dir, ".dev.vars"), readFileSync(example, "utf8").replace(/^BETTER_AUTH_SECRET=$/m, `BETTER_AUTH_SECRET=${secret}`));
};

/**
 * Copies the template, keeps only the chosen blocks (and what they require), names the project and
 * adds the Claude harness. Installing packages and generating migrations are left to the caller.
 */
export const scaffold = (options: ScaffoldOptions): ScaffoldResult => {
  const { templateDir, harnessDir, targetDir, name, blocks } = options;
  const problem = validateName(name);
  if (problem) throw new Error(problem);
  if (!isEmptyDir(targetDir)) throw new Error(`${targetDir} is not empty.`);

  const available = loadManifests(templateDir);
  const unknown = blocks.filter((b) => !available.has(b) || available.get(b)?.core);
  if (unknown.length) throw new Error(`Unknown block(s): ${unknown.join(", ")}. Choose from: ${[...available.keys()].filter((b) => b !== "core").join(", ")}`);

  mkdirSync(targetDir, { recursive: true });
  cpSync(templateDir, targetDir, { recursive: true });
  renameSync(join(targetDir, "_gitignore"), join(targetDir, ".gitignore"));
  writeProject(targetDir, { ...readProject(targetDir), name });

  const kept = prune(targetDir, blocks);
  rename(targetDir, name);
  sync(targetDir);
  writeDevVars(targetDir);

  const harness = Boolean(harnessDir && existsSync(harnessDir));
  if (harness && harnessDir) installHarness(harnessDir, targetDir);
  return { blocks: kept, harness };
};
