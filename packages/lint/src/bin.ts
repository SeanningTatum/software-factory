#!/usr/bin/env node
import { lint, projectRules, rules } from "./lint.ts";
import { runTimeline } from "./timeline-git.ts";

const args = process.argv.slice(2);

const usage = `cf-saas-lint [command]

  (none)                     run the house rules on this project
  --rules                    list the rules
  timeline [--base <ref>]    fail when a feature changed since <ref> (default origin/main, else
           [--skip]          HEAD~1) without a new line in its TIMELINE.md; --skip or
                             TIMELINE_SKIP=1 skips it`;

const runLint = () => {
  const findings = lint(process.cwd());
  for (const f of findings) console.error(`${f.file}:${f.line}  ${f.rule}  ${f.message}`);
  if (!findings.length) {
    console.log("cf-saas-lint: no problems.");
    return 0;
  }
  console.error(
    `\n${findings.length} problem(s). Allow a file only in cf-saas-lint.json "allow", with a reason in review.`,
  );
  return 1;
};

const timeline = () => {
  const at = args.indexOf("--base");
  const base = at >= 0 ? args[at + 1] : undefined;
  const skip = args.includes("--skip") || ["1", "true"].includes(process.env.TIMELINE_SKIP ?? "");
  const result = runTimeline(process.cwd(), { base, skip });
  for (const line of result.lines) (result.code ? console.error : console.log)(line);
  return result.code;
};

const main = () => {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage);
    return 0;
  }
  if (args.includes("--rules")) {
    for (const rule of [...rules, ...projectRules]) {
      console.log(`${rule.id.padEnd(20)} ${rule.description}`);
    }
    return 0;
  }
  if (args[0] === "timeline") return timeline();
  if (args[0]) {
    console.error(`Unknown command "${args[0]}".\n\n${usage}`);
    return 1;
  }
  return runLint();
};

process.exitCode = main();
