import { basename, dirname } from "node:path";
import { globToRegExp, matchesAny } from "../glob.ts";
import type { Rule } from "./types.ts";

/** `{file}`: the name without its extension. `{name}`: also without `.machine`. */
const fileStem = (file: string) => basename(file).replace(/\.tsx?$/, "");
const nameStem = (file: string) => fileStem(file).replace(/\.machine$/, "");
/** `{feature}`: the folder under the features dir, or empty outside it. */
const featureOf = (file: string, dir: string) =>
  file.startsWith(`${dir}/`) ? (file.slice(dir.length + 1).split("/")[0] ?? "") : "";

export const testMap: Rule = {
  id: "test-map",
  description: "Every source file has its proof: the tests the test map requires for it.",
  check: ({ file, config, allFiles }) => {
    if (matchesAny(file, config.testExempt)) return [];
    const required = config.testMap
      .filter((e) => globToRegExp(e.files).test(file))
      .flatMap((e) => e.requires);
    const missing = [...new Set(required)]
      .map((pattern) =>
        pattern
          .replaceAll("{dir}", dirname(file))
          .replaceAll("{file}", fileStem(file))
          .replaceAll("{name}", nameStem(file))
          .replaceAll("{feature}", featureOf(file, config.featureLayout.dir)),
      )
      .filter((pattern) => {
        const re = globToRegExp(pattern);
        return ![...allFiles].some((f) => re.test(f));
      });
    return missing.map((m) => ({ line: 1, message: `missing its test: ${m}` }));
  },
};
