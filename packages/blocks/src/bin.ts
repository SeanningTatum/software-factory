#!/usr/bin/env node
import { BlockError, check, loadManifests, removeBlock, sync } from "./index.ts";

const [command, arg] = process.argv.slice(2);
const root = process.cwd();

const usage = `cf-saas-blocks <command>

  sync            regenerate src/gen, .dev.vars.example and wrangler.jsonc from block.json files
  check           fail when generated files are stale or an import crosses a block boundary
  list            list enabled blocks
  remove <block>  delete a block and everything it owns

Add blocks with: bunx create-tanstack-cf-saas add <block>`;

const run = () => {
  switch (command) {
    case "sync": {
      const changed = sync(root);
      console.log(changed.length ? `Updated:\n  ${changed.join("\n  ")}` : "Already in sync.");
      return 0;
    }
    case "check": {
      const problems = check(root);
      for (const p of problems) console.error(`${p.file}: ${p.message}`);
      if (problems.length) console.error(`\n${problems.length} block problem(s).`);
      return problems.length ? 1 : 0;
    }
    case "list": {
      for (const [name, m] of loadManifests(root)) {
        if (!m.core) console.log(`${name.padEnd(10)} ${m.description}`);
      }
      return 0;
    }
    case "remove": {
      if (!arg) break;
      removeBlock(root, arg);
      console.log(`Removed ${arg}. Run your package manager's install to drop unused packages.`);
      return 0;
    }
  }
  console.log(usage);
  return command ? 1 : 0;
};

try {
  process.exitCode = run();
} catch (error) {
  console.error(error instanceof BlockError ? error.message : error);
  process.exitCode = 1;
}
