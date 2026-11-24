#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { add, create, harness, remove, setup } from "./commands.ts";

const createCommand = defineCommand({
  meta: { name: "create", description: "Create a new project (the default command)" },
  args: {
    dir: { type: "positional", required: false, description: "Folder for the new project" },
    name: { type: "string", description: "Project name (lowercase, dashes); defaults to the folder name" },
    blocks: { type: "string", description: "Comma-separated blocks: d1,auth,billing,kv,workflows,r2 (empty for core only)" },
    pm: { type: "string", description: "Package manager: bun, pnpm, npm or yarn" },
    yes: { type: "boolean", default: false, description: "Accept defaults and ask nothing" },
    claude: { type: "boolean", default: true, description: "Add the Claude workflows (--no-claude to skip)" },
    install: { type: "boolean", default: true, description: "Install packages (--no-install to skip)" },
    git: { type: "boolean", default: true, description: "Run git init (--no-git to skip)" },
  },
  run: ({ args }) =>
    create({
      dir: args.dir,
      name: args.name,
      blocks: args.blocks,
      pm: args.pm,
      yes: args.yes,
      claude: args.claude,
      install: args.install,
      git: args.git,
    }),
});

const main = defineCommand({
  meta: {
    name: "create-tanstack-cf-saas",
    version: "0.1.0",
    description: "TanStack Start SaaS on Cloudflare Workers, built from blocks. Run with a folder to create a project.",
  },
  subCommands: {
    create: createCommand,
    add: defineCommand({
      meta: { description: "Add a block (and the blocks it needs) to this project" },
      args: { block: { type: "positional", required: true } },
      run: ({ args }) => add(args.block),
    }),
    remove: defineCommand({
      meta: { description: "Remove a block and everything it owns" },
      args: { block: { type: "positional", required: true } },
      run: ({ args }) => remove(args.block),
    }),
    setup: defineCommand({
      meta: { description: "Create Cloudflare resources and set secrets; --check lists what is missing" },
      args: {
        check: { type: "boolean", default: false, description: "Only report; change nothing" },
        env: { type: "string", description: "production or staging (default: both)" },
        var: { type: "string", description: "KEY=value to set in wrangler.jsonc vars; repeatable" },
        yes: { type: "boolean", default: false, description: "Ask nothing; secrets come from environment variables" },
      },
      run: ({ args, rawArgs }) => {
        const vars = rawArgs.flatMap((arg, i) =>
          arg === "--var" ? [rawArgs[i + 1] ?? ""] : arg.startsWith("--var=") ? [arg.slice(6)] : [],
        );
        return setup({ check: args.check, env: args.env, vars: vars.filter((v) => v.includes("=")), yes: args.yes });
      },
    }),
    harness: defineCommand({
      meta: { description: "check: show local edits to .claude/; sync: update it from this CLI's copy" },
      args: {
        action: { type: "positional", required: true, description: "check or sync" },
        force: { type: "boolean", default: false, description: "sync: replace locally edited files too" },
      },
      run: ({ args }) => harness(args.action, args.force),
    }),
  },
});

const SUBCOMMANDS = new Set(["create", "add", "remove", "setup", "harness"]);
const first = process.argv[2];
/** `create-tanstack-cf-saas my-app --blocks auth` means create; `--help` alone shows every command. */
const showAll = first === "--help" || first === "-h" || (first !== undefined && SUBCOMMANDS.has(first));

(showAll ? runMain(main) : runMain(createCommand)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
