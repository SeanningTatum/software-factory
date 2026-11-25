import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, posix, win32 } from "node:path";
import { Schema } from "effect";

const EnvName = Schema.Literals(["production", "staging"]);

const VarSpec = Schema.Struct({
  description: Schema.String,
  required: Schema.Boolean,
  default: Schema.optionalKey(Schema.String),
  /** What `.dev.vars.example` shows when it should differ from the deployed default. */
  example: Schema.optionalKey(Schema.String),
  help: Schema.optionalKey(Schema.String),
});

const D1Binding = Schema.Struct({
  type: Schema.Literal("d1"),
  binding: Schema.String,
  database: Schema.String,
  migrations_dir: Schema.optionalKey(Schema.String),
});
const KvBinding = Schema.Struct({
  type: Schema.Literal("kv"),
  binding: Schema.String,
  namespace: Schema.String,
});
const R2Binding = Schema.Struct({
  type: Schema.Literal("r2"),
  binding: Schema.String,
  bucket: Schema.String,
});
const WorkflowBinding = Schema.Struct({
  type: Schema.Literal("workflow"),
  binding: Schema.String,
  name: Schema.String,
  class_name: Schema.String,
});
const RateLimitBinding = Schema.Struct({
  type: Schema.Literal("ratelimit"),
  binding: Schema.String,
  namespace_id: Schema.String.check(Schema.isPattern(/^\d+$/)),
  limit: Schema.Number,
  period: Schema.Literals([10, 60]),
});
const AnalyticsEngineBinding = Schema.Struct({
  type: Schema.Literal("analytics_engine"),
  binding: Schema.String,
  dataset: Schema.String,
});

export const Binding = Schema.Union([
  D1Binding,
  KvBinding,
  R2Binding,
  WorkflowBinding,
  RateLimitBinding,
  AnalyticsEngineBinding,
]);
export type Binding = typeof Binding.Type;

const SetupStep = Schema.Struct({
  id: Schema.String,
  description: Schema.String,
  help: Schema.optionalKey(Schema.String),
});

const StringMap = Schema.Record(Schema.String, Schema.String);

export const BlockManifest = Schema.Struct({
  $schema: Schema.optionalKey(Schema.String),
  name: Schema.String,
  title: Schema.String,
  description: Schema.String,
  /** A required feature or module ships in every project and can't be removed. */
  required: Schema.optionalKey(Schema.Boolean),
  requires: Schema.Array(Schema.String),
  files: Schema.optionalKey(Schema.Array(Schema.String)),
  bindings: Schema.optionalKey(Schema.Array(Binding)),
  vars: Schema.optionalKey(Schema.Record(Schema.String, VarSpec)),
  secrets: Schema.optionalKey(Schema.Record(Schema.String, VarSpec)),
  packageJson: Schema.optionalKey(
    Schema.Struct({
      dependencies: Schema.optionalKey(StringMap),
      devDependencies: Schema.optionalKey(StringMap),
      scripts: Schema.optionalKey(StringMap),
    }),
  ),
  setup: Schema.optionalKey(Schema.Array(SetupStep)),
});
export type BlockManifest = typeof BlockManifest.Type;
export type EnvName = typeof EnvName.Type;
export const envNames: ReadonlyArray<EnvName> = ["production", "staging"];

const decodeManifest = Schema.decodeUnknownSync(BlockManifest);

export const FEATURES_DIR = "src/features";
/** The group folder for core modules: shared services other features build on, with no pages. */
export const CORE_DIR = `${FEATURES_DIR}/core`;
/** Shared pure helpers inside core. Not a module: it has no feature.json and is always there. */
export const SHARED_LIB_DIR = `${CORE_DIR}/lib`;
export const MANIFEST_FILE = "feature.json";
/** Names no feature may take: the core group folder and the shared helpers folder. */
export const RESERVED_NAMES: ReadonlyArray<string> = ["core", "lib"];

/** A manifest plus where it was found: `src/features/<name>` or `src/features/core/<name>`. */
export type Feature = BlockManifest & {
  /** The feature's folder, from the project root. */
  readonly dir: string;
};

export const readManifest = (path: string): BlockManifest => {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof raw === "object" && raw !== null && "core" in raw) {
    throw new Error(
      `${path}: "core" is now "required"; rename the key (a core module is one that lives in ${CORE_DIR})`,
    );
  }
  return decodeManifest(raw);
};

/** Lower-case words joined by single hyphens, so the generated code can name it. */
const NAME = /^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*$/;

/** Why a `files` entry is unsafe to copy or delete, or undefined: it must stay inside the project. */
const unsafeFile = (file: string): string | undefined => {
  const path = posix.normalize(file.replaceAll("\\", "/"));
  if (!file.trim() || path === "." || path.startsWith("./")) return "is the project itself";
  if (isAbsolute(file) || win32.isAbsolute(file)) return "is absolute";
  if (path === ".." || path.startsWith("../")) return "climbs out of the project";
  return undefined;
};

/** Whether a feature lives in the core group. */
export const isCoreModule = (feature: Pick<Feature, "dir">) =>
  feature.dir.startsWith(`${CORE_DIR}/`);

/** Folders under `parent` that hold a feature.json. */
const manifestDirs = (root: string, parent: string): ReadonlyArray<string> => {
  const full = join(root, parent);
  if (!existsSync(full)) return [];
  return readdirSync(full, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(full, e.name, MANIFEST_FILE)))
    .map((e) => `${parent}/${e.name}`);
};

/**
 * Where a feature lives, found by its name: `src/features/core/<name>` or `src/features/<name>`.
 * Undefined when neither has a feature.json.
 */
export const featureDir = (root: string, name: string): string | undefined =>
  [`${CORE_DIR}/${name}`, `${FEATURES_DIR}/${name}`].find((dir) =>
    existsSync(join(root, dir, MANIFEST_FILE)),
  );

/**
 * Throws when two features declare the same env name (var, secret or binding: all keys of `Env`)
 * or the same workflow class, which would generate duplicate code.
 */
const rejectClashes = (manifests: ReadonlyMap<string, BlockManifest>) => {
  const owners = new Map<string, string>();
  const claim = (key: string, label: string, name: string) => {
    const owner = owners.get(key);
    if (owner && owner !== name)
      throw new Error(`"${label}" is declared by both ${owner} and ${name}`);
    owners.set(key, name);
  };
  for (const m of manifests.values()) {
    const envNames = [
      ...Object.keys(m.vars ?? {}),
      ...Object.keys(m.secrets ?? {}),
      ...(m.bindings ?? []).map((b) => b.binding),
    ];
    for (const key of envNames) claim(`env:${key}`, key, m.name);
    for (const b of m.bindings ?? [])
      if (b.type === "workflow") claim(`class:${b.class_name}`, b.class_name, m.name);
  }
};

/** Reads every feature.json under src/features and src/features/core, required ones included. */
export const loadManifests = (root: string): Map<string, Feature> => {
  const manifests = new Map<string, Feature>();
  const dirs = [...manifestDirs(root, CORE_DIR), ...manifestDirs(root, FEATURES_DIR)];
  for (const dir of dirs) {
    const path = `${dir}/${MANIFEST_FILE}`;
    const folder = dir.slice(dir.lastIndexOf("/") + 1);
    const manifest = readManifest(join(root, path));
    if (manifest.name !== folder) {
      throw new Error(`${path}: name "${manifest.name}" must match its folder "${folder}"`);
    }
    if (!NAME.test(manifest.name)) {
      throw new Error(`${path}: name "${manifest.name}" must be lower-case words joined by "-"`);
    }
    for (const file of manifest.files ?? []) {
      const why = unsafeFile(file);
      if (why) throw new Error(`${path}: "files" entry "${file}" ${why}; list paths inside it`);
    }
    if (RESERVED_NAMES.includes(manifest.name)) {
      throw new Error(`${path}: "${manifest.name}" is a reserved name; choose another`);
    }
    const other = manifests.get(manifest.name);
    if (other) {
      throw new Error(`${path}: "${manifest.name}" is also ${other.dir}; feature names are unique`);
    }
    manifests.set(manifest.name, { ...manifest, dir });
  }
  rejectClashes(manifests);
  return manifests;
};

/** What a feature owns: its folder, plus any extra paths its manifest lists. */
export const ownedPaths = (feature: Feature): ReadonlyArray<string> => [
  feature.dir,
  ...(feature.files ?? []),
];

/** Loaded features by name. */
export type Features = ReadonlyMap<string, Feature>;
