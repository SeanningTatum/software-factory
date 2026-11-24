// biome-ignore-all lint/performance/noBarrelFile: this is the package entry other tools import.
export {
  CONFIG_FILE,
  type CoreLayout,
  defaultFeatureLayout,
  defaults,
  type FeatureLayout,
  type LintConfig,
  loadConfig,
  type TestMapEntry,
} from "./config.ts";
export { globToRegExp, matchesAny } from "./glob.ts";
export { lint, projectRules, rules } from "./lint.ts";
export { type Place, placeOf } from "./place.ts";
export { coreRule } from "./rules/feature-layout.ts";
export type { Finding, ProjectRule, Rule } from "./rules/types.ts";
export {
  newEntries,
  type TimelineProblem,
  type TimelineText,
  timelineProblems,
  touchedFeatures,
} from "./timeline.ts";
export {
  GENERATED_END,
  GENERATED_START,
  handWritten,
  MACHINES_END,
  MACHINES_START,
  TIMELINE_FILE,
  withBlock,
} from "./timeline-doc.ts";
export { runTimeline, type TimelineOptions, type TimelineResult } from "./timeline-git.ts";
