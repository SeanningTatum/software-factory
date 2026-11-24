/**
 * Scaffolds one project per feature combination and runs every gate on each: the proof that each
 * optional feature adds and removes cleanly. Workspace packages are linked from this repo, since
 * generated projects would otherwise fetch them from npm.
 *
 *   bun scripts/block-matrix.ts [outDir] [--only core,auth]
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasTables, scaffold } from "../src/scaffold.ts";

const repo = join(import.meta.dirname, "../../..");
const template = join(import.meta.dirname, "../template");
const outDir =
  process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : join(tmpdir(), "cf-saas-matrix");
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex > 0 ? (process.argv[onlyIndex + 1] ?? "").split(",") : undefined;

/** `core` has no optional features; `all` has every one. */
const combos: Record<string, ReadonlyArray<string>> = {
  core: [],
  db: ["db"],
  auth: ["auth"],
  billing: ["billing"],
  kv: ["kv"],
  workflows: ["workflows"],
  uploads: ["uploads"],
  all: ["db", "auth", "billing", "kv", "workflows", "uploads"],
};

const localPackages: Record<string, string> = {
  "@tanstack-cf-saas/biome-config": "packages/biome-config",
  "@tanstack-cf-saas/blocks": "packages/blocks",
  "@tanstack-cf-saas/lint": "packages/lint",
  "@tanstack-cf-saas/tsconfig": "packages/tsconfig",
};

/** Packs each workspace package the way npm would get it, with workspace:* rewritten. */
const packAll = (into: string): Record<string, string> => {
  mkdirSync(into, { recursive: true });
  return Object.fromEntries(
    Object.entries(localPackages).map(([name, rel]) => {
      const result = spawnSync("bun", ["pm", "pack", "--destination", into, "--quiet"], {
        cwd: join(repo, rel),
        encoding: "utf8",
      });
      if (result.status !== 0) throw new Error(`packing ${name} failed:\n${result.stderr}`);
      const tarball = result.stdout.trim().split("\n").pop() ?? "";
      return [name, `file:${tarball.startsWith("/") ? tarball : join(into, tarball)}`];
    }),
  );
};

const linkLocal = (dir: string, tarballs: Record<string, string>) => {
  const path = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  for (const [name, spec] of Object.entries(tarballs)) {
    if (pkg.devDependencies?.[name]) pkg.devDependencies[name] = spec;
  }
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
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
    harnessDir: undefined,
    targetDir: dir,
    name: `matrix-${name}`,
    features,
  }).features;
  console.log(`\n${name}: ${kept.length ? kept.join(", ") : "core features only"}`);
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
