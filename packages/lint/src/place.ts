import type { FeatureLayout } from "./config.ts";

/** Where a path sits among the features. `folder` is relative to the features dir. */
export type Place =
  /** A feature outside the core group, e.g. folder `auth`. */
  | { readonly kind: "feature"; readonly folder: string; readonly inner: string }
  /** A core module, e.g. folder `core/kv`. */
  | { readonly kind: "core"; readonly folder: string; readonly inner: string }
  /** The shared helpers, folder `core/lib`. */
  | { readonly kind: "lib"; readonly folder: string; readonly inner: string }
  /** A file loose in the features dir or the core group, outside any folder. */
  | { readonly kind: "loose"; readonly folder: string; readonly inner: string };

const split = (rest: string): readonly [string, string] | undefined => {
  const cut = rest.indexOf("/");
  return cut < 0 ? undefined : [rest.slice(0, cut), rest.slice(cut + 1)];
};

/** Where `path` (from the project root) sits, or undefined outside the features dir. */
export const placeOf = (layout: FeatureLayout, path: string): Place | undefined => {
  const prefix = `${layout.dir}/`;
  if (!path.startsWith(prefix)) return undefined;
  const rest = path.slice(prefix.length);
  const top = split(rest);
  if (!top) return { kind: "loose", folder: "", inner: rest };
  const [name, inner] = top;
  if (name !== layout.core.dir) return { kind: "feature", folder: name, inner };
  const sub = split(inner);
  if (!sub) return { kind: "loose", folder: name, inner };
  const [module, moduleInner] = sub;
  const folder = `${name}/${module}`;
  return module === layout.core.lib
    ? { kind: "lib", folder, inner: moduleInner }
    : { kind: "core", folder, inner: moduleInner };
};
