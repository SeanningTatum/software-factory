import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { type LintConfig, loadConfig } from "./config.ts";
import { matchesAny } from "./glob.ts";
import { externalCallSpan, fileSize, noProcessEnv, noRunEffect, noThrow, noTryCatch } from "./rules/ast-rules.ts";
import { testMap } from "./rules/test-map.ts";
import type { Finding, Rule } from "./rules/types.ts";

export const rules: ReadonlyArray<Rule> = [
  noThrow,
  noTryCatch,
  noRunEffect,
  noProcessEnv,
  externalCallSpan,
  fileSize,
  testMap,
];

/** Rules that tests may break: they throw from mocks and run effects directly. */
const SOURCE_ONLY = new Set(["no-throw", "no-try-catch", "no-run-effect", "external-call-span"]);
const TEST_FILE = /\.(test|spec)\.tsx?$/;

const walk = (root: string, dir: string): ReadonlyArray<string> =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(root, path) : [relative(root, path)];
  });

export const lint = (root: string, config: LintConfig = loadConfig(root)): ReadonlyArray<Finding> => {
  const allFiles = new Set(walk(root, root));
  const targets = [...allFiles].filter((f) => matchesAny(f, config.include) && !matchesAny(f, config.exclude));
  const findings: Array<Finding> = [];
  for (const file of targets.sort()) {
    const text = readFileSync(join(root, file), "utf8");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    for (const rule of rules) {
      if (TEST_FILE.test(file) && SOURCE_ONLY.has(rule.id)) continue;
      if (matchesAny(file, config.allow[rule.id] ?? [])) continue;
      for (const f of rule.check({ root, file, source, config, allFiles })) {
        findings.push({ rule: rule.id, file, ...f });
      }
    }
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
};
