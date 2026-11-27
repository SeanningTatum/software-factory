import { byCodeUnit } from "@seanningtatum/software-factory-lint";
import type { BlockManifest } from "./manifest.ts";

export type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
};

const fields = ["dependencies", "devDependencies", "scripts"] as const;

const sorted = (record: Record<string, string>) =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => byCodeUnit(a, b)));

/**
 * Adds every entry the blocks list that package.json lacks. Versions and scripts already there are
 * kept, so a project can pin or rewrite them.
 */
export const withBlockPackages = (
  pkg: PackageJson,
  blocks: Iterable<BlockManifest>,
): PackageJson => {
  const manifests = [...blocks];
  const out: PackageJson = { ...pkg };
  for (const field of fields) {
    const current = { ...(pkg[field] ?? {}) };
    const missing = manifests
      .flatMap((m) => Object.entries(m.packageJson?.[field] ?? {}))
      .filter(([key]) => !(key in current));
    if (!missing.length) continue;
    for (const [key, value] of missing) if (!(key in current)) current[key] = value;
    out[field] = field === "scripts" ? current : sorted(current);
  }
  return out;
};

/**
 * Drops the entries only `removed` blocks listed, when they still hold the block's value. Entries a
 * kept block also lists stay, and so does anything the project pinned or rewrote: it may be its own.
 */
export const withoutBlockPackages = (
  pkg: PackageJson,
  removed: ReadonlyArray<BlockManifest>,
  kept: ReadonlyArray<BlockManifest>,
): PackageJson => {
  const out: PackageJson = { ...pkg };
  for (const field of fields) {
    const existing = pkg[field];
    if (!existing) continue;
    const stillUsed = new Set(kept.flatMap((m) => Object.keys(m.packageJson?.[field] ?? {})));
    const current = { ...existing };
    for (const m of removed) {
      for (const [key, value] of Object.entries(m.packageJson?.[field] ?? {}))
        if (!stillUsed.has(key) && current[key] === value) delete current[key];
    }
    out[field] = current;
  }
  return out;
};

export const packageText = (pkg: PackageJson) => `${JSON.stringify(pkg, null, 2)}\n`;
