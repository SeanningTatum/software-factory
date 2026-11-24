#!/usr/bin/env node
import { check, loadManifests, removeBlock, sync } from "./index.ts";

const [command, arg] = process.argv.slice(2);
const root = process.cwd();

const usage = `cf-saas-blocks <command>

  sync              regenerate src/gen, .dev.vars.example, wrangler.jsonc, FEATURES.md and the
                    generated block of each feature's TIMELINE.md from feature.json files
  check             fail when generated files are stale, a file has no owner, or an import
                    crosses a feature boundary
  list              list what can be removed: optional features and core modules
  remove <feature>  delete a feature or core module and everything it owns

Add features with: bunx create-tanstack-cf-saas add <feature>`;

const commands: Record<string, () => number | undefined> = {
  sync: () => {
    const changed = sync(root);
    console.log(changed.length ? `Updated:\n  ${changed.join("\n  ")}` : "Already in sync.");
    return 0;
  },
  check: () => {
    const problems = check(root);
    for (const p of problems) console.error(`${p.file}: ${p.message}`);
    if (problems.length) console.error(`\n${problems.length} feature problem(s).`);
    return problems.length ? 1 : 0;
  },
  list: () => {
    for (const [name, m] of loadManifests(root)) {
      if (!m.required) console.log(`${name.padEnd(10)} ${m.description}`);
    }
    return 0;
  },
  remove: () => {
    if (!arg) return undefined;
    removeBlock(root, arg);
    console.log(`Removed ${arg}. Run your package manager's install to drop unused packages.`);
    return 0;
  },
};

const run = () => {
  const code = command ? commands[command]?.() : undefined;
  if (code !== undefined) return code;
  console.log(usage);
  return command ? 1 : 0;
};

try {
  process.exitCode = run();
} catch (error) {
  // The tool's own errors say what to fix; a stack would only bury that.
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
