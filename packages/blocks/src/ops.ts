import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { dependentsOf, withRequirements } from "./graph.ts";
import { type Feature, loadManifests, ownedPaths } from "./manifest.ts";
import {
  type PackageJson,
  packageText,
  withBlockPackages,
  withoutBlockPackages,
} from "./package-json.ts";
import { plan, sync } from "./sync.ts";

const readPackage = (root: string): PackageJson =>
  JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const writePackage = (root: string, pkg: PackageJson) =>
  writeFileSync(join(root, "package.json"), packageText(pkg));

/** A path from the root in one spelling, for comparing what features own. */
const tidy = (path: string) => posix.normalize(path.replaceAll("\\", "/")).replace(/\/$/, "");
const overlaps = (a: string, b: string) =>
  a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

/** Deletes what `removed` own, except paths a kept feature owns too (or that hold or sit in one). */
const deleteOwned = (
  root: string,
  removed: ReadonlyArray<Feature>,
  kept: ReadonlyArray<Feature>,
) => {
  const others = kept.flatMap(ownedPaths).map(tidy);
  for (const path of removed.flatMap(ownedPaths).map(tidy)) {
    if (!others.some((o) => overlaps(path, o)))
      rmSync(join(root, path), { recursive: true, force: true });
  }
};

/**
 * Keeps only `selected` features (plus what they require, and every required feature) in a project
 * that has every feature, as `create` does right after copying the template. Core modules and
 * features are pruned alike. Returns the optional features kept, in order.
 */
export const prune = (root: string, selected: ReadonlyArray<string>): ReadonlyArray<string> => {
  const manifests = loadManifests(root);
  const optional = selected.filter((n) => !manifests.get(n)?.required);
  const keep = withRequirements(manifests, optional).filter((n) => !manifests.get(n)?.required);
  const all = [...manifests.values()].filter((m) => !m.required);
  const removed = all.filter((m) => !keep.includes(m.name));
  const kept = [...manifests.values()].filter((m) => !removed.includes(m));
  plan(root); // fails on a broken project before anything is deleted
  deleteOwned(root, removed, kept);
  writePackage(root, withoutBlockPackages(readPackage(root), removed, kept));
  sync(root);
  return keep;
};

export class BlockError extends Error {}

/**
 * Removes one feature or core module: its folder plus its `files`. Refuses required ones and ones
 * others require.
 */
export const removeBlock = (root: string, name: string) => {
  const manifests = loadManifests(root);
  const manifest = manifests.get(name);
  if (!manifest) throw new BlockError(`"${name}" is not an enabled feature`);
  if (manifest.required) throw new BlockError(`"${name}" is required; it can't be removed`);
  const dependents = dependentsOf(manifests, [...manifests.keys()], name);
  if (dependents.length) {
    throw new BlockError(`"${name}" is required by ${dependents.join(", ")}; remove those first`);
  }
  const kept = [...manifests.values()].filter((m) => m.name !== name);
  plan(root); // fails on a broken project before anything is deleted
  deleteOwned(root, [manifest], kept);
  writePackage(root, withoutBlockPackages(readPackage(root), [manifest], kept));
  sync(root);
};

/**
 * Copies a feature, and any features it requires that are missing, from a full template, each to
 * the folder it has there (`src/features/<name>` or `src/features/core/<name>`).
 */
export const addBlock = (
  root: string,
  templateRoot: string,
  name: string,
): ReadonlyArray<string> => {
  const available = loadManifests(templateRoot);
  const enabled = loadManifests(root);
  const wanted = withRequirements(available, [name]).filter((n) => !enabled.has(n));
  const added = wanted.map((n) => {
    const manifest = available.get(n);
    if (!manifest) throw new BlockError(`Unknown feature "${n}"`);
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
