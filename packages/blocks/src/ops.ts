import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dependentsOf, withRequirements } from "./graph.ts";
import { loadManifests, ownedPaths } from "./manifest.ts";
import { type PackageJson, packageText, withBlockPackages, withoutBlockPackages } from "./package-json.ts";
import { sync } from "./sync.ts";

const readPackage = (root: string): PackageJson => JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const writePackage = (root: string, pkg: PackageJson) => writeFileSync(join(root, "package.json"), packageText(pkg));

/**
 * Keeps only `selected` blocks (plus what they require) in a project that has every block,
 * as `create` does right after copying the template. Returns the blocks kept, in order.
 */
export const prune = (root: string, selected: ReadonlyArray<string>): ReadonlyArray<string> => {
  const manifests = loadManifests(root);
  const keep = withRequirements(manifests, selected.filter((n) => n !== "core"));
  const all = [...manifests.values()].filter((m) => !m.core);
  const removed = all.filter((m) => !keep.includes(m.name));
  for (const m of removed) for (const path of ownedPaths(m)) rmSync(join(root, path), { recursive: true, force: true });
  writePackage(root, withoutBlockPackages(readPackage(root), removed, all.filter((m) => keep.includes(m.name))));
  sync(root);
  return keep;
};

export class BlockError extends Error {}

/** Removes one block. Refuses while another enabled block requires it. */
export const removeBlock = (root: string, name: string) => {
  const manifests = loadManifests(root);
  const manifest = manifests.get(name);
  if (!manifest || manifest.core) throw new BlockError(`"${name}" is not an enabled block`);
  const dependents = dependentsOf(manifests, [...manifests.keys()], name);
  if (dependents.length) {
    throw new BlockError(`"${name}" is required by ${dependents.join(", ")}; remove those first`);
  }
  for (const path of ownedPaths(manifest)) rmSync(join(root, path), { recursive: true, force: true });
  const kept = [...manifests.values()].filter((m) => m.name !== name);
  writePackage(root, withoutBlockPackages(readPackage(root), [manifest], kept));
  sync(root);
};

/** Copies a block, and any blocks it requires that are missing, from a full template. */
export const addBlock = (root: string, templateRoot: string, name: string): ReadonlyArray<string> => {
  const available = loadManifests(templateRoot);
  const enabled = loadManifests(root);
  const wanted = withRequirements(available, [name]).filter((n) => !enabled.has(n));
  const added = wanted.map((n) => {
    const manifest = available.get(n);
    if (!manifest) throw new BlockError(`Unknown block "${n}"`);
    for (const path of ownedPaths(manifest)) {
      const from = join(templateRoot, path);
      if (existsSync(from)) cpSync(from, join(root, path), { recursive: true });
    }
    return manifest;
  });
  writePackage(root, withBlockPackages(readPackage(root), added));
  sync(root);
  return wanted;
};
