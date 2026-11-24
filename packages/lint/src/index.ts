export { CONFIG_FILE, defaults, type LintConfig, loadConfig, type TestMapEntry } from "./config.ts";
export { globToRegExp, matchesAny } from "./glob.ts";
export { lint, rules } from "./lint.ts";
export type { Finding, Rule } from "./rules/types.ts";
