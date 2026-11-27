/**
 * Scaffolds one project per feature combination and runs every gate on each: the proof that each
 * optional feature adds and removes cleanly. Workspace packages are linked from this repo, since
 * generated projects would otherwise fetch them from npm.
 *
 *   bun scripts/block-matrix.ts [outDir] [--only required,auth]
 *
 * outDir is a folder name, made inside $RUNNER_TEMP in CI or the system temp folder elsewhere.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { addBlock, check, removeBlock } from "@tanstack-cf-saas/blocks";
import { hasTables, scaffold } from "../src/scaffold.ts";
import { linkLocal, packAll } from "./pack.ts";

const template = join(import.meta.dirname, "../template");
/** The Claude workflows ship with every project, so the gates must pass with them in place. */
const harness = join(import.meta.dirname, "../harness");
const tempRoot = resolve(process.env.RUNNER_TEMP ?? tmpdir());
const outDir = join(
  tempRoot,
  basename(
    process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "cf-saas-matrix",
  ),
);
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

/** Optional features, dependents before what they require, so each can be removed in turn. */
const REMOVAL_ORDER = ["uploads", "billing", "workflows", "kv", "auth", "db"];

/** Fast, install-free: after every add or remove, `cf-saas-blocks check` must find nothing. */
const walkFeatures = (name: string, kind: "remove" | "add", failures: Array<string>) => {
  const dir = join(outDir, `${name}-${kind}`);
  scaffold({
    templateDir: template,
    harnessDir: undefined,
    targetDir: dir,
    name: `matrix-${name}-${kind}`,
    features: kind === "remove" ? (combos.all ?? []) : [],
  });
  console.log(`\n${name}: ${kind} each optional feature in turn`);
  const order = kind === "remove" ? REMOVAL_ORDER : [...REMOVAL_ORDER].reverse();
  for (const feature of order) {
    try {
      if (kind === "remove") removeBlock(dir, feature, { force: true });
      else addBlock(dir, template, feature);
      const problems = check(dir);
      if (problems.length)
        throw new Error(problems.map((p) => `${p.file}: ${p.message}`).join("; "));
      console.log(`  ✓ ${kind} ${feature}`);
    } catch (error) {
      console.log(`  ✗ ${kind} ${feature}: ${error instanceof Error ? error.message : error}`);
      failures.push(`${name}: ${kind} ${feature}`);
      return;
    }
  }
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

// A run wipes outDir: keep it inside the temp folder, and new, empty or left by an earlier run.
if (!outDir.startsWith(tempRoot + sep)) {
  console.log(`${outDir} is outside ${tempRoot}. Pass a folder inside it.`);
  process.exit(1);
}
if (existsSync(outDir) && readdirSync(outDir).length && !existsSync(join(outDir, ".packs"))) {
  console.log(`${outDir} holds files this script did not make. Pass a new or empty folder.`);
  process.exit(1);
}
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const failures: Array<string> = [];
if (only && !Object.keys(combos).some((name) => only.includes(name))) {
  console.log(`--only selects nothing. Choose from: ${Object.keys(combos).join(", ")}`);
  process.exit(1);
}
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
    // One combination runs every gate without .github/, as a project made with --no-github does.
    github: name !== "required",
  }).features;
  console.log(`\n${name}: ${kept.length ? kept.join(", ") : "required features only"}`);
  linkLocal(dir, tarballs);
  const steps: Array<[string, string, Array<string>]> = [
    ["install", "bun", ["install"]],
    ...(hasTables(dir)
      ? ([["db:generate", "bun", ["run", "db:generate", "init"]]] as Array<
          [string, string, Array<string>]
        >)
      : []),
    ["biome", "bunx", ["biome", "check", "."]],
    ["house rules", "bunx", ["cf-saas-lint"]],
    ["feature check", "bunx", ["cf-saas-blocks", "check"]],
    ["typecheck", "bunx", ["tsc", "-p", "."]],
    ["unit tests", "bun", ["run", "test"]],
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
  if (name === "all") walkFeatures(name, "remove", failures);
  if (name === "required") walkFeatures(name, "add", failures);
}

console.log(
  failures.length ? `\nFailed:\n  ${failures.join("\n  ")}` : "\nEvery combination passed.",
);
process.exitCode = failures.length ? 1 : 0;
