/**
 * Scaffolds one project per feature combination and runs every gate on each: the proof that each
 * optional feature adds and removes cleanly. Workspace packages are linked from this repo, since
 * generated projects would otherwise fetch them from npm.
 *
 *   bun scripts/block-matrix.ts [outDir] [--only required,auth]
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasTables, scaffold } from "../src/scaffold.ts";
import { linkLocal, packAll } from "./pack.ts";

const template = join(import.meta.dirname, "../template");
/** The Claude workflows ship with every project, so the gates must pass with them in place. */
const harness = join(import.meta.dirname, "../harness");
const outDir =
  process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : join(tmpdir(), "cf-saas-matrix");
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex > 0 ? (process.argv[onlyIndex + 1] ?? "").split(",") : undefined;

/** `required` has no optional features or modules; `all` has every one. */
const combos: Record<string, ReadonlyArray<string>> = {
  required: [],
  db: ["db"],
  auth: ["auth"],
  billing: ["billing"],
  kv: ["kv"],
  workflows: ["workflows"],
  uploads: ["uploads"],
  all: ["db", "auth", "billing", "kv", "workflows", "uploads"],
};

const step = (dir: string, label: string, cmd: string, args: Array<string>) => {
  const started = Date.now();
  const result = spawnSync(cmd, args, {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
  });
  const ok = result.status === 0;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`  ${ok ? "✓" : "✗"} ${label} (${seconds}s)`);
  if (!ok) console.log((result.stdout + result.stderr).split("\n").slice(-25).join("\n"));
  return ok;
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const failures: Array<string> = [];
const tarballs = packAll(join(outDir, ".packs"));

for (const [name, features] of Object.entries(combos)) {
  if (only && !only.includes(name)) continue;
  const dir = join(outDir, name);
  const kept = scaffold({
    templateDir: template,
    harnessDir: harness,
    targetDir: dir,
    name: `matrix-${name}`,
    features,
  }).features;
  console.log(`\n${name}: ${kept.length ? kept.join(", ") : "required features only"}`);
  linkLocal(dir, tarballs);
  const steps: Array<[string, string, Array<string>]> = [
    ["install", "bun", ["install"]],
    ...(hasTables(dir)
      ? ([["db:generate", "bun", ["run", "db:generate"]]] as Array<[string, string, Array<string>]>)
      : []),
    ["biome", "bunx", ["biome", "check", "."]],
    ["house rules", "bunx", ["cf-saas-lint"]],
    ["feature check", "bunx", ["cf-saas-blocks", "check"]],
    ["typecheck", "bunx", ["tsc", "-p", "."]],
    ["unit tests", "bunx", ["vitest", "run"]],
    ["knip", "bunx", ["knip"]],
    ["build", "bunx", ["vite", "build"]],
    ["size", "bun", ["run", "size"]],
  ];
  for (const [label, cmd, args] of steps) {
    if (!step(dir, label, cmd, args)) {
      failures.push(`${name}: ${label}`);
      break;
    }
  }
}

console.log(
  failures.length ? `\nFailed:\n  ${failures.join("\n  ")}` : "\nEvery combination passed.",
);
process.exitCode = failures.length ? 1 : 0;
