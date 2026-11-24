import type { BlockManifest } from "./manifest.ts";

export type Manifests = ReadonlyMap<string, BlockManifest>;

const lookup = (manifests: Manifests, name: string): BlockManifest => {
  const manifest = manifests.get(name);
  if (!manifest) throw new Error(`Unknown block "${name}"`);
  return manifest;
};

/** The selected blocks plus everything they require, transitively. */
export const withRequirements = (
  manifests: Manifests,
  selected: Iterable<string>,
): ReadonlyArray<string> => {
  const out = new Set<string>();
  const visit = (name: string) => {
    if (out.has(name)) return;
    out.add(name);
    for (const dep of lookup(manifests, name).requires) visit(dep);
  };
  for (const name of selected) visit(name);
  return topoSort(manifests, [...out]);
};

/** Sorts blocks so each comes after everything it requires. Stable by name. */
export const topoSort = (manifests: Manifests, names: ReadonlyArray<string>): ReadonlyArray<string> => {
  const wanted = new Set(names);
  const done = new Set<string>();
  const visiting = new Set<string>();
  const order: Array<string> = [];
  const visit = (name: string) => {
    if (done.has(name)) return;
    if (visiting.has(name)) throw new Error(`Blocks require each other in a cycle at "${name}"`);
    visiting.add(name);
    for (const dep of lookup(manifests, name).requires) {
      if (!wanted.has(dep)) throw new Error(`Block "${name}" requires "${dep}", which is not enabled`);
      visit(dep);
    }
    visiting.delete(name);
    done.add(name);
    order.push(name);
  };
  for (const name of [...names].sort()) visit(name);
  return order;
};

/** Enabled blocks that require `name`, directly or not. */
export const dependentsOf = (
  manifests: Manifests,
  enabled: ReadonlyArray<string>,
  name: string,
): ReadonlyArray<string> =>
  enabled.filter((other) => other !== name && withRequirements(manifests, [other]).includes(name));
