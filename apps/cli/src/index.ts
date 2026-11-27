#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import pc from "picocolors";
import { legacyArgs } from "./args.ts";
import { add, create, github, harness, remove, setup } from "./commands.ts";
import { VERSION } from "./version.ts";

/** Runs a command and prints what went wrong as one line, without a stack: these are user errors. */
function guarded<T>(fn: (context: T) => unknown) {
  return async (context: T) => {
    try {
      await fn(context);
    } catch (error) {
      console.error(pc.red(error instanceof Error ? error.message : String(error)));
      process.exitCode = 1;
    }
  };
}

const createCommand = defineCommand({
  meta: { name: "create", description: "Create a new project (the default command)" },
  args: {
    dir: { type: "positional", required: false, description: "Folder for the new project" },
    name: {
      type: "string",
      description: "Project name (lowercase, dashes); defaults to the folder name",
    },
    features: {
      type: "string",
      description:
        "Comma-separated features: db,auth,billing,kv,workflows,uploads (empty for the required ones only)",
    },
    pm: { type: "string", description: "Package manager: bun, pnpm, npm or yarn" },
    yes: { type: "boolean", default: false, description: "Accept defaults and ask nothing" },
    claude: {
      type: "boolean",
      default: true,
      description: "Add the Claude workflows (--no-claude to skip)",
    },
    husky: {
      type: "boolean",
      default: true,
      description: "Add husky hooks for conventional, small commits (--no-husky to skip)",
    },
    github: {
      type: "boolean",
      default: true,
      description:
        "Add the GitHub workflows and branch rules: CI, deploys and the promote button (--no-github to skip)",
    },
    install: {
      type: "boolean",
      default: true,
      description: "Install packages (--no-install to skip)",
    },
    git: { type: "boolean", default: true, description: "Run git init (--no-git to skip)" },
  },
  run: guarded(({ args }) =>
    create({
      dir: args.dir,
      name: args.name,
      features: args.features,
      pm: args.pm,
      yes: args.yes,
      claude: args.claude,
      husky: args.husky,
      github: args.github,
      install: args.install,
      git: args.git,
    }),
  ),
});

const main = defineCommand({
  meta: {
    name: "create-software-factory",
    version: VERSION,
    description:
      "TanStack Start SaaS on Cloudflare Workers, built from features. Run with a folder to create a project.",
  },
  subCommands: {
    create: createCommand,
    add: defineCommand({
      meta: { description: "Add features (and the features they need): `add kv workflows`" },
      args: { feature: { type: "positional", required: true } },
      run: guarded(({ args }) => add(...args._)),
    }),
    remove: defineCommand({
      meta: { description: "Remove features and everything they own" },
      args: {
        feature: { type: "positional", required: true },
        force: {
          type: "boolean",
          default: false,
          description: "Remove even with uncommitted changes in the feature's files",
        },
      },
      run: guarded(({ args }) => remove(args._, args.force)),
    }),
    setup: defineCommand({
      meta: {
        description:
          "Create Cloudflare resources, apply migrations, set secrets and make the first deploy; --check lists what is missing",
      },
      args: {
        check: { type: "boolean", default: false, description: "Only report; change nothing" },
        env: { type: "string", description: "production or staging (default: both)" },
        var: { type: "string", description: "KEY=value to set in wrangler.jsonc vars; repeatable" },
        yes: {
          type: "boolean",
          default: false,
          description: "Ask nothing; secrets come from environment variables",
        },
      },
      run: guarded(({ args, rawArgs }) => {
        const vars = rawArgs.flatMap((arg, i) =>
          arg === "--var" ? [rawArgs[i + 1] ?? ""] : arg.startsWith("--var=") ? [arg.slice(6)] : [],
        );
        const bad = vars.find((v) => !v.includes("="));
        if (bad !== undefined) throw new Error(`--var needs KEY=value, got "${bad}".`);
        return setup({
          check: args.check,
          env: args.env,
          vars,
          yes: args.yes,
        });
      }),
    }),
    github: defineCommand({
      meta: {
        description:
          "Put the project on GitHub: staging as the default branch, production protected, the rulesets in .github/rulesets/, the Cloudflare settings CI deploys with, and an issue for each setup step left to do by hand",
      },
      args: {
        public: {
          type: "boolean",
          default: false,
          description: "Make a new repository public (private is the default)",
        },
      },
      run: guarded(({ args }) => github(args.public)),
    }),
    harness: defineCommand({
      meta: {
        description: "check: show local edits to .claude/; sync: update it from this CLI's copy",
      },
      args: {
        action: { type: "positional", required: true, description: "check or sync" },
        force: {
          type: "boolean",
          default: false,
          description: "sync: replace locally edited files too",
        },
      },
      run: guarded(({ args }) => harness(args.action, args.force)),
    }),
  },
});

const SUBCOMMANDS = new Set(["create", "add", "remove", "setup", "github", "harness"]);
const MAIN_FLAGS = new Set(["--help", "-h", "--version", "-v"]);
const rawArgs = legacyArgs(process.argv.slice(2));
const first = rawArgs[0];
/** `create-software-factory my-app --features auth` means create; `--help` alone shows every command. */
const toMain = first !== undefined && (MAIN_FLAGS.has(first) || SUBCOMMANDS.has(first));

if (toMain) runMain(main, { rawArgs });
else runMain(createCommand, { rawArgs });
