import { applyEdits, type FormattingOptions, modify, parse } from "jsonc-parser";
import type { Manifests } from "./graph.ts";
import type { Binding, EnvName } from "./manifest.ts";

export const WRANGLER_FILE = "wrangler.jsonc";
export const PLACEHOLDER_D1_ID = "00000000-0000-0000-0000-000000000000";
export const PLACEHOLDER_KV_ID = "00000000000000000000000000000000";
const STAGING_NAMESPACE_OFFSET = 1000;

const formatting: FormattingOptions = { insertSpaces: false, tabSize: 1, eol: "\n" };

type Entry = Record<string, unknown>;
type Section =
  | "d1_databases"
  | "kv_namespaces"
  | "r2_buckets"
  | "workflows"
  | "ratelimits"
  | "analytics_engine_datasets";

const sectionOf: Record<Binding["type"], Section> = {
  d1: "d1_databases",
  kv: "kv_namespaces",
  r2: "r2_buckets",
  workflow: "workflows",
  ratelimit: "ratelimits",
  analytics_engine: "analytics_engine_datasets",
};
const sections = Object.values(sectionOf);

/** Wrangler names rate limiters by `name`; everything else by `binding`. */
const keyOf = (section: Section, entry: Entry) =>
  String(section === "ratelimits" ? entry.name : entry.binding);

export const resourceName = (template: string, project: string, env: EnvName) =>
  template.replaceAll("{project}", project).replaceAll("{suffix}", env === "staging" ? "-staging" : "");

/** The entry wrangler wants for a binding. `existing` keeps ids that setup already filled in. */
const entryFor = (binding: Binding, project: string, env: EnvName, existing?: Entry): Entry => {
  switch (binding.type) {
    case "d1":
      return {
        binding: binding.binding,
        database_name: resourceName(binding.database, project, env),
        database_id: existing?.database_id ?? PLACEHOLDER_D1_ID,
        migrations_dir: binding.migrations_dir ?? "drizzle",
      };
    case "kv":
      return { binding: binding.binding, id: existing?.id ?? PLACEHOLDER_KV_ID };
    case "r2":
      return { binding: binding.binding, bucket_name: resourceName(binding.bucket, project, env) };
    case "workflow":
      return {
        binding: binding.binding,
        name: resourceName(binding.name, project, env),
        class_name: binding.class_name,
      };
    case "ratelimit": {
      const offset = env === "staging" ? STAGING_NAMESPACE_OFFSET : 0;
      return {
        name: binding.binding,
        namespace_id: String(Number(binding.namespace_id) + offset),
        simple: { limit: binding.limit, period: binding.period },
      };
    }
    case "analytics_engine":
      return { binding: binding.binding, dataset: resourceName(binding.dataset, project, env) };
  }
};

export interface WranglerPatch {
  readonly project: string;
  readonly manifests: Manifests;
  /** Binding and var names the tool added before; only these are ever removed. */
  readonly previouslyManaged: { readonly bindings: ReadonlyArray<string>; readonly vars: ReadonlyArray<string> };
}

export interface WranglerResult {
  readonly text: string;
  readonly managed: { bindings: Array<string>; vars: Array<string> };
}

const scopes: ReadonlyArray<{ env: EnvName; path: ReadonlyArray<string> }> = [
  { env: "production", path: [] },
  { env: "staging", path: ["env", "staging"] },
];

const at = (value: unknown, path: ReadonlyArray<string>): Entry | undefined => {
  let cursor: unknown = value;
  for (const key of path) cursor = (cursor as Entry | undefined)?.[key];
  return cursor as Entry | undefined;
};

/**
 * Adds every enabled block's bindings and vars to wrangler.jsonc, for production and staging.
 * Entries the tool did not add, ids already filled in, var values already set and all comments
 * outside the edited arrays are kept.
 */
export const patchWrangler = (text: string, patch: WranglerPatch): WranglerResult => {
  const bindings = [...patch.manifests.values()].flatMap((m) => m.bindings ?? []);
  const vars = new Map(
    [...patch.manifests.values()].flatMap((m) =>
      Object.entries(m.vars ?? {}).map(([key, spec]) => [key, spec.default ?? ""] as const),
    ),
  );
  const managedBindings = new Set(bindings.map((b) => b.binding));
  const dropBinding = new Set(patch.previouslyManaged.bindings.filter((b) => !managedBindings.has(b)));
  const dropVar = new Set(patch.previouslyManaged.vars.filter((v) => !vars.has(v)));

  let out = text;
  for (const scope of scopes) {
    const current = at(parse(out), scope.path) ?? {};
    for (const section of sections) {
      const existing = (current[section] as Array<Entry> | undefined) ?? [];
      const byKey = new Map(existing.map((e) => [keyOf(section, e), e]));
      const kept = existing.filter((e) => {
        const key = keyOf(section, e);
        return !dropBinding.has(key) && !managedBindings.has(key);
      });
      const wanted = bindings
        .filter((b) => sectionOf[b.type] === section)
        .map((b) => entryFor(b, patch.project, scope.env, byKey.get(b.binding)));
      const next = [...kept, ...wanted];
      const value = next.length ? next : undefined;
      if (JSON.stringify(value) !== JSON.stringify(current[section])) {
        out = applyEdits(out, modify(out, [...scope.path, section], value, { formattingOptions: formatting }));
      }
    }
    const currentVars = (at(parse(out), [...scope.path, "vars"]) ?? {}) as Record<string, unknown>;
    const nextVars: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(currentVars)) if (!dropVar.has(key)) nextVars[key] = value;
    for (const [key, value] of vars) if (!(key in nextVars)) nextVars[key] = value;
    if (JSON.stringify(nextVars) !== JSON.stringify(currentVars)) {
      const value = Object.keys(nextVars).length ? nextVars : undefined;
      out = applyEdits(out, modify(out, [...scope.path, "vars"], value, { formattingOptions: formatting }));
    }
  }
  return { text: out, managed: { bindings: [...managedBindings].sort(), vars: [...vars.keys()].sort() } };
};

/** Sets one field on one binding, for setup to record a created resource's id. */
export const setBindingField = (
  text: string,
  env: EnvName,
  section: Section,
  binding: string,
  field: string,
  value: string,
): string => {
  const path = env === "staging" ? ["env", "staging"] : [];
  const entries = (at(parse(text), path)?.[section] as Array<Entry> | undefined) ?? [];
  const index = entries.findIndex((e) => keyOf(section, e) === binding);
  if (index < 0) throw new Error(`${WRANGLER_FILE}: no ${section} entry for ${binding} (${env})`);
  return applyEdits(text, modify(text, [...path, section, index, field], value, { formattingOptions: formatting }));
};

export const readBinding = (
  text: string,
  env: EnvName,
  section: Section,
  binding: string,
): Entry | undefined => {
  const path = env === "staging" ? ["env", "staging"] : [];
  const entries = (at(parse(text), path)?.[section] as Array<Entry> | undefined) ?? [];
  return entries.find((e) => keyOf(section, e) === binding);
};

export type { Section };
