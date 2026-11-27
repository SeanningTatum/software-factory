import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "@typescript/typescript6";
import { type LintConfig, loadConfig } from "./config.ts";
import { walk } from "./files.ts";
import { matchesAny } from "./glob.ts";
import {
  externalCallSpan,
  fileSize,
  noInlineHandler,
  noNestedYield,
  noProcessEnv,
  noRunEffect,
  noThrow,
  noTryCatch,
} from "./rules/ast-rules.ts";
import { noDuplicateComment, noUselessComment } from "./rules/comments.ts";
import { featureLayout } from "./rules/feature-layout.ts";
import { rulesFile } from "./rules/rules-file.ts";
import { sharedLib } from "./rules/shared-lib.ts";
import { testMap } from "./rules/test-map.ts";
import type { Finding, ProjectRule, Rule } from "./rules/types.ts";

export const rules: ReadonlyArray<Rule> = [
  noThrow,
  noTryCatch,
  noRunEffect,
  noProcessEnv,
  externalCallSpan,
  noNestedYield,
  noInlineHandler,
  noUselessComment,
  fileSize,
  testMap,
  sharedLib,
];

/** Rules over the whole file list, not one source file. */
export const projectRules: ReadonlyArray<ProjectRule> = [
  featureLayout,
  rulesFile,
  noDuplicateComment,
];

/** Rules that tests may break: they throw from mocks and run effects directly. */
const SOURCE_ONLY = new Set([
  "no-throw",
  "no-try-catch",
  "no-run-effect",
  "external-call-span",
  "no-inline-handler",
]);
const TEST_FILE = /\.(test|spec)\.tsx?$/;

const fileFindings = (
  root: string,
  file: string,
  config: LintConfig,
  allFiles: ReadonlySet<string>,
): ReadonlyArray<Finding> => {
  const text = readFileSync(join(root, file), "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  return rules
    .filter((rule) => !(TEST_FILE.test(file) && SOURCE_ONLY.has(rule.id)))
    .filter((rule) => !matchesAny(file, config.allow[rule.id] ?? []))
    .flatMap((rule) =>
      rule
        .check({ root, file, source, config, allFiles })
        .map((f) => ({ rule: rule.id, file, ...f })),
    );
};

const projectFindings = (
  root: string,
  config: LintConfig,
  allFiles: ReadonlySet<string>,
): ReadonlyArray<Finding> => {
  const ruleIds = new Set([...rules, ...projectRules].map((r) => r.id));
  return projectRules.flatMap((rule) =>
    rule
      .checkProject({ root, config, allFiles, ruleIds })
      .filter((f) => !matchesAny(f.file, config.allow[rule.id] ?? []))
      .map((f) => ({ rule: rule.id, ...f })),
  );
};

export const lint = (
  root: string,
  config: LintConfig = loadConfig(root),
): ReadonlyArray<Finding> => {
  const allFiles = new Set(walk(root, root));
  const targets = [...allFiles].filter(
    (f) => matchesAny(f, config.include) && !matchesAny(f, config.exclude),
  );
  // Run from the wrong folder, or with a stale "include", the rules would pass on nothing.
  const message = `no file matches "include" (${config.include.join(", ")})`;
  const findings = [
    ...(targets.length ? [] : [{ rule: "no-files", file: "cf-saas-lint.json", line: 1, message }]),
    ...targets.sort().flatMap((file) => fileFindings(root, file, config, allFiles)),
    ...projectFindings(root, config, allFiles),
  ];
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
};
