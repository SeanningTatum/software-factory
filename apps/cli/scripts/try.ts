/**
 * Runs the real CLI from this repo, the way `bunx create-tanstack-cf-saas` will run once it is
 * published. New projects depend on the @tanstack-cf-saas packages, which are not on npm yet, so
 * this packs them here and points the bundled template at the tarballs before the CLI starts.
 *
 *   bun run try                                   the wizard, into ../cf-saas-try
 *   bun run try ../my-app --features db,auth --yes
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repo = join(import.meta.dirname, "../../..");
const cli = join(repo, "apps/cli");
const packs = join(cli, ".packs");
const defaultDir = resolve(repo, "../cf-saas-try");

const localPackages: Record<string, string> = {
  "@tanstack-cf-saas/biome-config": "packages/biome-config",
  "@tanstack-cf-saas/blocks": "packages/blocks",
  "@tanstack-cf-saas/lint": "packages/lint",
  "@tanstack-cf-saas/tsconfig": "packages/tsconfig",
};

const run = (label: string, cmd: string, args: Array<string>, cwd: string) => {
  console.log(`• ${label}`);
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stdout + result.stderr);
    process.exit(1);
  }
  return result.stdout;
};

const [first, ...restArgs] = process.argv.slice(2);
const dirGiven = first !== undefined && !first.startsWith("-");
const target = dirGiven ? resolve(process.env.INIT_CWD ?? process.cwd(), first) : defaultDir;
const flags = dirGiven ? restArgs : process.argv.slice(2);

// Only the default folder is cleared, and only when an earlier try made it.
if (!dirGiven && existsSync(join(target, "cf-saas.json"))) {
  console.log(`• Removing the last try at ${target}`);
  rmSync(target, { recursive: true, force: true });
}

run(
  "Building the packages and the CLI",
  "bunx",
  ["turbo", "run", "build", "--filter=./packages/*", "--filter=create-tanstack-cf-saas"],
  repo,
);

rmSync(packs, { recursive: true, force: true });
mkdirSync(packs, { recursive: true });
const templatePackage = join(cli, "template/package.json");
const pkg = JSON.parse(readFileSync(templatePackage, "utf8"));
for (const [name, rel] of Object.entries(localPackages)) {
  const out = run(
    `Packing ${name}`,
    "bun",
    ["pm", "pack", "--destination", packs, "--quiet"],
    join(repo, rel),
  );
  const tarball = out.trim().split("\n").pop() ?? "";
  if (pkg.devDependencies?.[name]) {
    pkg.devDependencies[name] = `file:${tarball.startsWith("/") ? tarball : join(packs, tarball)}`;
  }
}
writeFileSync(templatePackage, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`\nRunning the CLI into ${target}\n`);
const result = spawnSync("node", [join(cli, "dist/index.js"), target, ...flags], {
  stdio: "inherit",
});

if (result.status === 0) {
  console.log(
    `\nThis project uses the packages packed in ${packs}; it is for trying things, not for shipping.`,
  );
}
process.exitCode = result.status ?? 1;
