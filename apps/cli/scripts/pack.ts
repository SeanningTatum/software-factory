/** Packs this repo's packages the way npm would serve them, for projects made before they publish. */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

export const repo = join(import.meta.dirname, "../../..");

const localPackages: Record<string, string> = {
  "@tanstack-cf-saas/biome-config": "packages/biome-config",
  "@tanstack-cf-saas/blocks": "packages/blocks",
  "@tanstack-cf-saas/lint": "packages/lint",
  "@tanstack-cf-saas/tsconfig": "packages/tsconfig",
  // Projects run `setup` from their own copy of the CLI. Build it before packing: it ships dist/.
  "create-tanstack-cf-saas": "apps/cli",
};

/**
 * Packs each workspace package into `into`, with workspace:* rewritten; returns `file:` specs.
 * `as` is the folder the specs name: pass a relative one when `into` travels with the project, so
 * the project installs wherever it is cloned.
 */
export const packAll = (into: string, as = into): Record<string, string> => {
  mkdirSync(into, { recursive: true });
  // Each run packs into a fresh temp folder: bun takes no argument from the caller (S8705), and
  // runs at the same time never share a tarball.
  const staging = mkdtempSync(join(tmpdir(), "cf-saas-pack-"));
  const specs = Object.fromEntries(
    Object.entries(localPackages).map(([name, rel]) => {
      const result = spawnSync(
        process.execPath,
        ["pm", "pack", `--destination=${staging}`, "--quiet"],
        { cwd: join(repo, rel), encoding: "utf8" },
      );
      if (result.status !== 0) throw new Error(`packing ${name} failed:\n${result.stderr}`);
      const tarball = basename(result.stdout.trim().split("\n").pop() ?? "");
      // Copy, not rename: `into` may be on another device.
      copyFileSync(join(staging, tarball), join(into, tarball));
      return [name, `file:${as}/${tarball}`];
    }),
  );
  rmSync(staging, { recursive: true, force: true });
  return specs;
};

/**
 * Points a project's (or template's) devDependencies at the packed tarballs. Overrides do the same
 * for the packages' own dependencies on each other, which npm can't serve yet.
 */
export const linkLocal = (dir: string, tarballs: Record<string, string>) => {
  const path = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  for (const [name, spec] of Object.entries(tarballs)) {
    if (pkg.devDependencies?.[name]) pkg.devDependencies[name] = spec;
  }
  pkg.overrides = { ...pkg.overrides, ...tarballs };
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
};
