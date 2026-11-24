import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_FILE = "cf-saas-lint.json";

export interface TestMapEntry {
  /** Source files this entry covers. Every matching entry applies. */
  readonly files: string;
  /**
   * Test files that must exist. `{dir}`, `{file}` (no extension), `{name}` (also no `.machine`)
   * and `{feature}` (the folder under src/features) come from the source file.
   */
  readonly requires: ReadonlyArray<string>;
}

export interface FeatureLayout {
  /** Where features live. Each folder under it is one feature. */
  readonly dir: string;
  /** Folders a feature may have. Anything may sit inside them. */
  readonly folders: ReadonlyArray<string>;
  /** Files a feature may have at its top level. A sibling `*.test.ts` of a `.ts` one is allowed too. */
  readonly files: ReadonlyArray<string>;
  /** Files every feature must have. */
  readonly required: ReadonlyArray<string>;
  /** File patterns that may sit only in the listed folders, e.g. `*.spec.ts` only in `e2e`. */
  readonly placement: Readonly<Record<string, ReadonlyArray<string>>>;
}

export interface LintConfig {
  /** Folders and files to lint. */
  readonly include: ReadonlyArray<string>;
  readonly exclude: ReadonlyArray<string>;
  /** Files where a rule is allowed, keyed by rule id. Keep these lists short. */
  readonly allow: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly maxLines: number;
  readonly testMap: ReadonlyArray<TestMapEntry>;
  /** Source files that need no test of their own: declarations, wiring, UI primitives. */
  readonly testExempt: ReadonlyArray<string>;
  /** The fixed vocabulary of folders and files inside a feature. */
  readonly featureLayout: FeatureLayout;
}

export const defaultFeatureLayout: FeatureLayout = {
  dir: "src/features",
  folders: ["api", "routes", "components", "machines", "lib", "e2e"],
  files: [
    "feature.json",
    "TIMELINE.md",
    "constants.ts",
    "schema.ts",
    "events.ts",
    "errors.ts",
    "layer.ts",
    "nav.ts",
    "viewer.ts",
    "auth-plugins.ts",
    "workflows.ts",
  ],
  required: ["feature.json", "TIMELINE.md"],
  placement: {
    "*.machine.ts": ["components", "machines"],
    "*.spec.ts": ["e2e"],
  },
};

export const defaults: LintConfig = {
  include: ["src/**/*.{ts,tsx}"],
  exclude: ["src/gen/**", "src/routeTree.gen.ts", "**/*.d.ts"],
  allow: {},
  maxLines: 400,
  testMap: [
    { files: "src/**/*.machine.ts", requires: ["{dir}/{file}.test.ts"] },
    {
      files: "src/features/*/components/*.machine.ts",
      requires: ["src/features/{feature}/e2e/{name}.paths.spec.ts"],
    },
    { files: "src/{app,features}/**/*.ts", requires: ["{dir}/{file}.test.ts"] },
  ],
  testExempt: ["**/*.test.ts", "**/*.spec.ts"],
  featureLayout: defaultFeatureLayout,
};

export const loadConfig = (root: string): LintConfig => {
  const path = join(root, CONFIG_FILE);
  if (!existsSync(path)) return defaults;
  const user = JSON.parse(readFileSync(path, "utf8")) as Partial<LintConfig>;
  return {
    ...defaults,
    ...user,
    exclude: [...defaults.exclude, ...(user.exclude ?? [])],
    testExempt: [...defaults.testExempt, ...(user.testExempt ?? [])],
    featureLayout: { ...defaults.featureLayout, ...user.featureLayout },
  };
};
