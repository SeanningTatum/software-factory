/**
 * Runs the real CLI from this repo, the way `bunx @seanningtatum/create-software-factory` will run once it is
 * published. New projects depend on the @seanningtatum packages, which are not on npm yet, so
 * this copies the bundled template, packs them into the copy's `.packs/`, points the copy at them
 * by relative path, and hands the copy to the CLI through SOFTWARE_FACTORY_TEMPLATE_DIR (an internal
 * variable, not listed in --help). The project carries the tarballs, so a clone of it installs
 * anywhere, GitHub Actions included. The bundled template itself is never changed, so it stays fit
 * to publish.
 *
 *   bun run try                                   the wizard, into ../software-factory-try
 *   bun run try ../my-app --features db,auth --yes
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { capture } from "../src/run.ts";
import { linkLocal, packAll, repo } from "./pack.ts";
import { ownRepository, teardownPlan } from "./teardown.ts";

const cli = join(repo, "apps/cli");
const packs = join(cli, ".packs");
const template = join(packs, "template");
const defaultDir = resolve(repo, "../software-factory-try");

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
if (!dirGiven && existsSync(join(target, "software-factory.json"))) {
  // The folder holds the only record of what that try made outside this machine.
  // shortcut: sees a repository and recorded D1 or KV ids; a bucket or draft Worker alone leaves no mark.
  const made = teardownPlan(target, ownRepository(target, capture("git", target)));
  if (made.some((s) => s.tool === "gh" || s.args[0] === "d1" || s.args[0] === "kv")) {
    console.error(
      `The last try at ${target} made things on Cloudflare or GitHub. Run \`bun run teardown\` first, or pass another folder.`,
    );
    process.exit(1);
  }
  console.log(`• Removing the last try at ${target}`);
  rmSync(target, { recursive: true, force: true });
}

run(
  "Building the packages and the CLI",
  "bunx",
  [
    "turbo",
    "run",
    "build",
    "--filter=./packages/*",
    "--filter=@seanningtatum/create-software-factory",
  ],
  repo,
);

rmSync(packs, { recursive: true, force: true });
cpSync(join(cli, "template"), template, { recursive: true });
console.log("• Packing the packages");
linkLocal(template, packAll(join(template, ".packs"), "./.packs"));

console.log(`\nRunning the CLI into ${target}\n`);
const env = { ...process.env, SOFTWARE_FACTORY_TEMPLATE_DIR: template };
const args = [join(cli, "dist/index.js"), target, ...flags];
const result = spawnSync("node", args, { stdio: "inherit", env }); // NOSONAR: runs the CLI with the developer's node, as npx would.

if (result.status === 0) {
  console.log(
    "\nThis project uses the packages packed in its .packs folder; it is for trying things, not for shipping.",
  );
}
process.exitCode = result.status ?? 1;
