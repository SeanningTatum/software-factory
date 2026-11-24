import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";

const EnvName = Schema.Literals(["production", "staging"]);

const VarSpec = Schema.Struct({
  description: Schema.String,
  required: Schema.Boolean,
  default: Schema.optionalKey(Schema.String),
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
  namespace_id: Schema.String,
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
  core: Schema.optionalKey(Schema.Boolean),
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

export const CORE_MANIFEST = "src/core/block.json";
export const BLOCKS_DIR = "src/blocks";

export const readManifest = (path: string): BlockManifest =>
  decodeManifest(JSON.parse(readFileSync(path, "utf8")));

export const blockManifestPath = (name: string) => `${BLOCKS_DIR}/${name}/block.json`;

/** Reads core plus every block folder that has a block.json. */
export const loadManifests = (root: string): Map<string, BlockManifest> => {
  const manifests = new Map<string, BlockManifest>();
  const core = join(root, CORE_MANIFEST);
  if (existsSync(core)) manifests.set("core", readManifest(core));
  const blocksDir = join(root, BLOCKS_DIR);
  if (!existsSync(blocksDir)) return manifests;
  for (const entry of readdirSync(blocksDir, { withFileTypes: true })) {
    const path = join(blocksDir, entry.name, "block.json");
    if (entry.isDirectory() && existsSync(path)) {
      const manifest = readManifest(path);
      if (manifest.name !== entry.name) {
        throw new Error(`${path}: name "${manifest.name}" must match its folder "${entry.name}"`);
      }
      manifests.set(manifest.name, manifest);
    }
  }
  return manifests;
};

/** The three places a block owns, plus any extra paths its manifest lists. */
export const ownedPaths = (manifest: BlockManifest): ReadonlyArray<string> => [
  `${BLOCKS_DIR}/${manifest.name}`,
  `src/routes/(${manifest.name})`,
  `e2e/${manifest.name}`,
  ...(manifest.files ?? []),
];
