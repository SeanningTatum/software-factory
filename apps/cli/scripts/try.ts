/**
 * Runs the real CLI from this repo, the way `bunx create-tanstack-cf-saas` will run once it is
 * published. New projects depend on the @tanstack-cf-saas packages, which are not on npm yet, so
 * this packs them here, copies the bundled template, points the copy at the tarballs, and hands the
 * copy to the CLI through CF_SAAS_TEMPLATE_DIR (an internal variable, not listed in --help). The
 * bundled template itself is never changed, so it stays fit to publish.
 *
 *   bun run try                                   the wizard, into ../cf-saas-try
 *   bun run try ../my-app --features db,auth --yes
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { linkLocal, packAll, repo } from "./pack.ts";

const cli = join(repo, "apps/cli");
const packs = join(cli, ".packs");
const template = join(packs, "template");
const defaultDir = resolve(repo, "../cf-saas-try");

const run = (label: string, cmd: string, args: Array<string>, cwd: string) => {
  console.log(`• ${label}`);
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stdout + result.stderr);
    process.exit(1);
  }
  return result.stdout;
};

// `bun run try -- <dir>` may pass the `--` through.
const argv = process.argv.slice(2).filter((arg, i) => i > 0 || arg !== "--");
const [first, ...restArgs] = argv;
const dirGiven = first !== undefined && !first.startsWith("-");
const target = dirGiven ? resolve(process.env.INIT_CWD ?? process.cwd(), first) : defaultDir;
const flags = dirGiven ? restArgs : argv;

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
console.log("• Packing the packages");
const tarballs = packAll(packs);
cpSync(join(cli, "template"), template, { recursive: true });
linkLocal(template, tarballs);

console.log(`\nRunning the CLI into ${target}\n`);
const result = spawnSync("node", [join(cli, "dist/index.js"), target, ...flags], {
  stdio: "inherit",
  env: { ...process.env, CF_SAAS_TEMPLATE_DIR: template },
});

if (result.status === 0) {
  console.log(
    `\nThis project uses the packages packed in ${packs}; it is for trying things, not for shipping.`,
  );
}
process.exitCode = result.status ?? 1;
