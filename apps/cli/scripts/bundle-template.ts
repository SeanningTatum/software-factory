/**
 * Copies the template and the Claude harness into this package so they ship with the CLI.
 * Only files git would commit are copied, and never local secrets (.dev.vars.*, .env) or
 * settings. Rewrites `workspace:*` to the versions published from this repo and stores .gitignore as
 * _gitignore, because npm drops .gitignore files from packages.
 */
import { execSync, spawnSync } from "node:child_process";
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
import { dirname, join, relative } from "node:path";

const repo = join(import.meta.dirname, "../../..");
const source = join(repo, "templates/saas-starter");
const target = join(import.meta.dirname, "../template");
const harnessSource = join(repo, "claude");
const harnessTarget = join(import.meta.dirname, "../harness");

const SKIP = new Set([
  "node_modules",
  ".wrangler",
  ".dev.vars",
  "dist",
  ".output",
  "worker-configuration.d.ts",
  "routeTree.gen.ts",
  "playwright-report",
  "test-results",
  ".turbo",
  ".tanstack",
]);
/** Generated migrations are rebuilt for the chosen features; only the folder itself ships. */
const skipPath = (path: string) => /^drizzle\/(?!\.gitkeep$)/.test(path);

/** Local files that must never ship, even when nothing ignores them: secrets and own settings. */
const LOCAL =
  /(?:^|\/)(?:\.env(?:\.(?!example$)[^/]*)?|\.dev\.vars(?:\.(?!example$)[^/]*)?|settings\.local\.json|\.DS_Store)$/;

/**
 * The files git would commit under `dir` (tracked, plus new ones it doesn't ignore), relative to
 * it; undefined outside a git checkout. New files count so work not yet committed still bundles.
 */
const gitFiles = (dir: string): ReadonlyArray<string> | undefined => {
  const listed = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "."],
    { cwd: dir, encoding: "utf8" },
  );
  if (listed.status !== 0) return undefined;
  return listed.stdout.split("\0").filter((f) => f && existsSync(join(dir, f)));
};

/** Copies `from` to `to`: git's files when it can list them, else everything but `skip`. */
const copyTree = (from: string, to: string, skip: (rel: string) => boolean) => {
  mkdirSync(to, { recursive: true });
  const files = gitFiles(from);
  if (!files) {
    cpSync(from, to, {
      recursive: true,
      filter: (path) => !skip(relative(from, path)) && !LOCAL.test(relative(from, path)),
    });
    return;
  }
  for (const file of files.filter((f) => !skip(f) && !LOCAL.test(f))) {
    mkdirSync(dirname(join(to, file)), { recursive: true });
    cpSync(join(from, file), join(to, file));
  }
};

rmSync(target, { recursive: true, force: true });
copyTree(source, target, (rel) => rel.split("/").some((part) => SKIP.has(part)) || skipPath(rel));
renameSync(join(target, ".gitignore"), join(target, "_gitignore"));

const versionOf = (name: string) => {
  for (const dir of readdirSync(join(repo, "packages"))) {
    const pkg = JSON.parse(readFileSync(join(repo, "packages", dir, "package.json"), "utf8"));
    if (pkg.name === name) return `^${pkg.version}`;
  }
  throw new Error(`No workspace package named ${name}`);
};

const pkgPath = join(target, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.name = "saas-starter";
for (const field of ["dependencies", "devDependencies"]) {
  for (const [name, version] of Object.entries<string>(pkg[field] ?? {})) {
    if (version.startsWith("workspace:")) pkg[field][name] = versionOf(name);
  }
}
const pkgText = `${JSON.stringify(pkg, null, 2)}\n`;
// A local link here would ship to every user: refuse to bundle it.
const local = /"(?:file|workspace|link):[^"]*"/.exec(pkgText);
if (local) throw new Error(`The template's package.json has a local dependency: ${local[0]}`);
writeFileSync(pkgPath, pkgText);

rmSync(harnessTarget, { recursive: true, force: true });
if (existsSync(harnessSource)) {
  copyTree(
    harnessSource,
    harnessTarget,
    (rel) => rel.split("/").includes(".git") || rel === "README.md",
  );
  const commit = (() => {
    const run = (cmd: string) =>
      execSync(cmd, {
        cwd: harnessSource,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    const inRepo = existsSync(join(harnessSource, ".git"));
    return inRepo ? run("git rev-parse HEAD") : "placeholder";
  })();
  writeFileSync(
    join(harnessTarget, ".source.json"),
    `${JSON.stringify({ repo: "claude", commit }, null, 2)}\n`,
  );
}

console.log(
  `Bundled the template into ${relative(repo, target)} and the harness into ${relative(repo, harnessTarget)}.`,
);
