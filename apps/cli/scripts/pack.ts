/** Packs this repo's packages the way npm would serve them, for projects made before they publish. */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const repo = join(import.meta.dirname, "../../..");

const localPackages: Record<string, string> = {
  "@tanstack-cf-saas/biome-config": "packages/biome-config",
  "@tanstack-cf-saas/blocks": "packages/blocks",
  "@tanstack-cf-saas/lint": "packages/lint",
  "@tanstack-cf-saas/tsconfig": "packages/tsconfig",
};

/** Packs each workspace package into `into`, with workspace:* rewritten; returns `file:` specs. */
export const packAll = (into: string): Record<string, string> => {
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
