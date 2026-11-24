/**
 * Copies the template and the Claude harness into this package so they ship with the CLI.
 * Rewrites `workspace:*` to the versions published from this repo and stores .gitignore as
 * _gitignore, because npm drops .gitignore files from packages.
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

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
  "docs",
  ".tanstack",
]);
/** Generated migrations are rebuilt for the chosen blocks; only the folder itself ships. */
const skipPath = (path: string) => /^drizzle\/(?!\.gitkeep$)/.test(path);

rmSync(target, { recursive: true, force: true });
cpSync(source, target, {
  recursive: true,
  filter: (from) => {
    const rel = relative(source, from);
    return !rel.split("/").some((part) => SKIP.has(part)) && !skipPath(rel);
  },
});
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
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

rmSync(harnessTarget, { recursive: true, force: true });
if (existsSync(harnessSource)) {
  cpSync(harnessSource, harnessTarget, {
    recursive: true,
    filter: (from) => !relative(harnessSource, from).split("/").includes(".git") && relative(harnessSource, from) !== "README.md",
  });
  const commit = (() => {
    const run = (cmd: string) => execSync(cmd, { cwd: harnessSource, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const inRepo = existsSync(join(harnessSource, ".git"));
    return inRepo ? run("git rev-parse HEAD") : "placeholder";
  })();
  writeFileSync(join(harnessTarget, ".source.json"), `${JSON.stringify({ repo: "claude", commit }, null, 2)}\n`);
}

console.log(`Bundled the template into ${relative(repo, target)} and the harness into ${relative(repo, harnessTarget)}.`);
