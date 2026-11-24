// biome-ignore-all lint/performance/noBarrelFile: this is the package entry the CLI imports.
export { FEATURES_INDEX, featuresIndex } from "./features-index.ts";
export {
  contributions,
  devVarsExample,
  enabledOrder,
  GEN_DIR,
  generateFiles,
  ROUTES_DIR,
} from "./generate.ts";
export { dependentsOf, topoSort, withRequirements } from "./graph.ts";
export {
  type Binding,
  BlockManifest,
  CORE_DIR,
  type EnvName,
  envNames,
  FEATURES_DIR,
  type Feature,
  type Features,
  featureDir,
  isCoreModule,
  loadManifests,
  MANIFEST_FILE,
  ownedPaths,
  RESERVED_NAMES,
  readManifest,
  SHARED_LIB_DIR,
} from "./manifest.ts";
export { addBlock, BlockError, prune, removeBlock } from "./ops.ts";
export { type PackageJson, withBlockPackages, withoutBlockPackages } from "./package-json.ts";
export { PROJECT_FILE, ProjectConfig, projectText, readProject, writeProject } from "./project.ts";
export { type FeatureScan, routePath, scanFeature } from "./scan.ts";
export {
  APP_DIR,
  APP_FILES,
  boundaryProblems,
  check,
  ownerOf,
  type Problem,
  plan,
  SHARED_LIB,
  sync,
} from "./sync.ts";
export {
  GENERATED_END,
  GENERATED_START,
  TIMELINE_FILE,
  TIMELINE_SKELETON,
  timelinePath,
  timelineSection,
  timelineText,
} from "./timeline.ts";
export {
  PLACEHOLDER_D1_ID,
  PLACEHOLDER_KV_ID,
  patchWrangler,
  readBinding,
  resourceName,
  type Section,
  setBindingField,
  WRANGLER_FILE,
} from "./wrangler.ts";
