import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_FILE = "cf-saas-lint.json";

export interface TestMapEntry {
  /** Source files this entry covers. Every matching entry applies. */
  readonly files: string;
  /** Test files that must exist. `{dir}`, `{file}` (no extension) and `{name}` (also no `.machine`) come from the source file. */
  readonly requires: ReadonlyArray<string>;
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
}

export const defaults: LintConfig = {
  include: ["src/**/*.{ts,tsx}"],
  exclude: ["src/gen/**", "src/routeTree.gen.ts", "**/*.d.ts"],
  allow: {},
  maxLines: 400,
  testMap: [
    { files: "src/**/*.machine.ts", requires: ["{dir}/{file}.test.ts"] },
    { files: "src/**/ui/*.machine.ts", requires: ["e2e/**/{name}.paths.spec.ts"] },
    { files: "src/{core,blocks}/**/*.ts", requires: ["{dir}/{file}.test.ts"] },
  ],
  testExempt: ["**/*.test.ts", "**/*.spec.ts"],
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
  };
};
