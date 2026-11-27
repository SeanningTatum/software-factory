import {
  applyEdits,
  type FormattingOptions,
  modify,
  type ParseError,
  parse,
  printParseErrorCode,
} from "jsonc-parser";
import type { Manifests } from "./graph.ts";
import type { Binding, EnvName } from "./manifest.ts";
import { byCodeUnit } from "./order.ts";

export const WRANGLER_FILE = "wrangler.jsonc";
export const PLACEHOLDER_D1_ID = "00000000-0000-0000-0000-000000000000";
export const PLACEHOLDER_KV_ID = "00000000000000000000000000000000";
const STAGING_NAMESPACE_OFFSET = 1000;

/** The file's own indent: the first indented line's tab or spaces. */
export const formattingOf = (text: string): FormattingOptions => {
  const indent = /^([ \t]+)\S/m.exec(text)?.[1] ?? "\t";
  return indent.startsWith("\t")
    ? { insertSpaces: false, tabSize: 1, eol: "\n" }
    : { insertSpaces: true, tabSize: indent.length, eol: "\n" };
};

/** The parsed file. Throws on a syntax error, so a broken file is never edited into a worse one. */
const parseWrangler = (text: string): Entry => {
  const errors: Array<ParseError> = [];
  const value = parse(text, errors, { allowTrailingComma: true });
  const [first] = errors;
  if (first) {
    const line = text.slice(0, first.offset).split("\n").length;
    throw new Error(
      `${WRANGLER_FILE}: ${printParseErrorCode(first.error)} on line ${line}. Fix it, then run sync again; nothing was changed.`,
    );
  }
  return (value ?? {}) as Entry;
};

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
  template
    .replaceAll("{project}", project)
    .replaceAll("{suffix}", env === "staging" ? "-staging" : "");

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
        // Ids are account-wide, so `create` gives each project its own and sync keeps it.
        namespace_id: existing?.namespace_id ?? String(Number(binding.namespace_id) + offset),
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
  readonly previouslyManaged: {
    readonly bindings: ReadonlyArray<string>;
    readonly vars: ReadonlyArray<string>;
  };
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

/** What one patch run wants: the bindings and vars to add, and the names to drop. */
interface Wanted {
  readonly project: string;
  readonly bindings: ReadonlyArray<Binding>;
  readonly managedBindings: ReadonlySet<string>;
  readonly dropBinding: ReadonlySet<string>;
  readonly vars: ReadonlyMap<string, string>;
  readonly dropVar: ReadonlySet<string>;
}

type Path = ReadonlyArray<string | number>;

const write = (text: string, path: Path, value: unknown, isArrayInsertion = false) =>
  applyEdits(
    text,
    modify(text, [...path], value, { formattingOptions: formattingOf(text), isArrayInsertion }),
  );

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Appends a binding's entry, or sets the fields the tool owns on the one already there. */
const upsert = (
  text: string,
  path: ReadonlyArray<string>,
  section: Section,
  binding: Binding,
  project: string,
  env: EnvName,
) => {
  const current = (at(parseWrangler(text), path) as Array<Entry> | undefined) ?? [];
  const index = current.findIndex((e) => keyOf(section, e) === binding.binding);
  // shortcut: limit, period, bucket and database names belong to the manifests and are reset to
  // them on every sync; the project name is the only knob. Upgrade by keeping existing fields.
  const entry = entryFor(binding, project, env, current[index]);
  if (index < 0) return write(text, [...path, -1], entry, true);
  let out = text;
  for (const [field, value] of Object.entries(entry)) {
    if (!same(current[index]?.[field], value)) out = write(out, [...path, index, field], value);
  }
  return out;
};

/**
 * Brings one section in line with the manifests, one edit at a time so comments, field order and
 * fields the tool does not set (`preview_id`, `remote`, ...) survive.
 */
const patchSection = (
  text: string,
  scope: (typeof scopes)[number],
  section: Section,
  want: Wanted,
) => {
  let out = text;
  const path = [...scope.path, section];
  const wanted = want.bindings.filter((b) => sectionOf[b.type] === section);
  const entries = () => (at(parseWrangler(out), path) as Array<Entry> | undefined) ?? [];
  const existed = at(parseWrangler(out), scope.path)?.[section] !== undefined;
  // Drop what the tool added and no longer wants, from the end so earlier indexes hold.
  const before = entries();
  for (let i = before.length - 1; i >= 0; i--) {
    const key = keyOf(section, before[i] as Entry);
    const drop = want.dropBinding.has(key) || want.managedBindings.has(key);
    if (drop && !wanted.some((b) => b.binding === key)) out = write(out, [...path, i], undefined);
  }
  for (const binding of wanted) out = upsert(out, path, section, binding, want.project, scope.env);
  return existed && !entries().length ? write(out, path, undefined) : out;
};

const patchVars = (text: string, scope: (typeof scopes)[number], want: Wanted) => {
  let out = text;
  const path = [...scope.path, "vars"];
  const vars = () => (at(parseWrangler(out), path) ?? {}) as Record<string, unknown>;
  const existed = Object.keys(vars()).length > 0;
  for (const key of Object.keys(vars())) {
    if (want.dropVar.has(key)) out = write(out, [...path, key], undefined);
  }
  for (const [key, value] of want.vars) {
    if (!(key in vars())) out = write(out, [...path, key], value);
  }
  return existed && !Object.keys(vars()).length ? write(out, path, undefined) : out;
};

/**
 * Adds every enabled feature's bindings and vars to wrangler.jsonc, for production and staging.
 * Entries the tool did not add, ids already filled in, var values already set and all comments
 * outside the edited arrays are kept.
 */
export const patchWrangler = (text: string, patch: WranglerPatch): WranglerResult => {
  parseWrangler(text);
  const bindings = [...patch.manifests.values()].flatMap((m) => m.bindings ?? []);
  const vars = new Map(
    [...patch.manifests.values()].flatMap((m) =>
      Object.entries(m.vars ?? {}).map(([key, spec]) => [key, spec.default ?? ""] as const),
    ),
  );
  const managedBindings = new Set(bindings.map((b) => b.binding));
  const want: Wanted = {
    project: patch.project,
    bindings,
    managedBindings,
    dropBinding: new Set(patch.previouslyManaged.bindings.filter((b) => !managedBindings.has(b))),
    vars,
    dropVar: new Set(patch.previouslyManaged.vars.filter((v) => !vars.has(v))),
  };
  let out = text;
  for (const scope of scopes) {
    for (const section of sections) out = patchSection(out, scope, section, want);
    out = patchVars(out, scope, want);
  }
  return {
    text: out,
    managed: {
      bindings: [...managedBindings].sort(byCodeUnit),
      vars: [...vars.keys()].sort(byCodeUnit),
    },
  };
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
  const entries = (at(parseWrangler(text), path)?.[section] as Array<Entry> | undefined) ?? [];
  const index = entries.findIndex((e) => keyOf(section, e) === binding);
  if (index < 0) throw new Error(`${WRANGLER_FILE}: no ${section} entry for ${binding} (${env})`);
  return write(text, [...path, section, index, field], value);
};

export const readBinding = (
  text: string,
  env: EnvName,
  section: Section,
  binding: string,
): Entry | undefined => {
  const path = env === "staging" ? ["env", "staging"] : [];
  const entries = (at(parseWrangler(text), path)?.[section] as Array<Entry> | undefined) ?? [];
  return entries.find((e) => keyOf(section, e) === binding);
};

export type { Section };
