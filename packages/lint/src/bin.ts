#!/usr/bin/env node
import { lint, rules } from "./lint.ts";

const args = process.argv.slice(2);
if (args.includes("--rules")) {
  for (const rule of rules) console.log(`${rule.id.padEnd(20)} ${rule.description}`);
  process.exit(0);
}

const findings = lint(process.cwd());
for (const f of findings) console.error(`${f.file}:${f.line}  ${f.rule}  ${f.message}`);
if (findings.length) {
  console.error(`\n${findings.length} problem(s). Allow a file only in cf-saas-lint.json "allow", with a reason in review.`);
  process.exitCode = 1;
} else {
  console.log("cf-saas-lint: no problems.");
}
