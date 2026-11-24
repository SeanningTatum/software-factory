import { resolve } from "node:path";
import * as p from "@clack/prompts";
import { addBlock, type EnvName, envNames, loadManifests, removeBlock, withRequirements } from "@tanstack-cf-saas/blocks";
import pc from "picocolors";
import { createActor, fromPromise, toPromise } from "xstate";
import { type CreatePlan, createMachine } from "./create.machine.ts";
import { harnessStatus, syncHarness } from "./harness.ts";
import { harnessDir, templateDir } from "./paths.ts";
import { detectPackageManager, execCommand, installCommand, type PackageManager, packageManagers, runCommand } from "./pm.ts";
import { projectWrangler, run } from "./run.ts";
import { hasTables, isEmptyDir, scaffold, validateName } from "./scaffold.ts";
import { isReady, type Item, provision, readiness } from "./setup.ts";

const cancelled = <T>(value: T): Exclude<T, symbol> => {
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
    process.exit(1);
  }
  return value as Exclude<T, symbol>;
};

export interface CreateArgs {
  readonly dir: string | undefined;
  readonly name: string | undefined;
  readonly blocks: string | undefined;
  readonly pm: string | undefined;
  readonly yes: boolean;
  readonly claude: boolean;
  readonly install: boolean;
  readonly git: boolean;
}

const blockOptions = () =>
  [...loadManifests(templateDir()).values()]
    .filter((m) => !m.core)
    .map((m) => ({ value: m.name, label: m.title, hint: m.requires.length ? `needs ${m.requires.join(", ")}` : m.description }));

const askPlan = async (args: CreateArgs): Promise<CreatePlan> => {
  const dirArg = args.dir ?? (args.yes ? "my-saas" : cancelled(await p.text({ message: "Where should the project go?", placeholder: "my-saas", defaultValue: "my-saas" })));
  const targetDir = resolve(dirArg);
  if (!isEmptyDir(targetDir)) throw new Error(`${targetDir} is not empty.`);
  const fallbackName = dirArg.split("/").pop()?.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "my-saas";
  const name =
    args.name ??
    (args.yes
      ? fallbackName
      : cancelled(await p.text({ message: "Project name", defaultValue: fallbackName, placeholder: fallbackName, validate: (v) => validateName(v || fallbackName) })));
  const manifests = loadManifests(templateDir());
  const chosen =
    args.blocks !== undefined
      ? args.blocks.split(",").map((b) => b.trim()).filter(Boolean)
      : args.yes
        ? ["d1", "auth", "billing"]
        : cancelled(await p.multiselect({ message: "Building blocks (core is always included)", options: blockOptions(), initialValues: ["d1", "auth"], required: false }));
  const blocks = withRequirements(manifests, chosen);
  const added = blocks.filter((b) => !chosen.includes(b));
  if (added.length) p.log.info(`Also adding ${added.join(", ")}, which ${chosen.join(", ")} need.`);
  const claude = args.yes || !args.claude ? args.claude : cancelled(await p.confirm({ message: "Add the Claude workflows (.claude/)?", initialValue: true }));
  return { name, targetDir, blocks, claude, install: args.install, git: args.git };
};

export const create = async (args: CreateArgs) => {
  p.intro(pc.inverse(" create-tanstack-cf-saas "));
  const plan = await askPlan(args);
  const pm = (packageManagers.includes(args.pm as PackageManager) ? args.pm : detectPackageManager()) as PackageManager;
  const spinner = p.spinner();

  const actor = createActor(
    createMachine.provide({
      actors: {
        scaffold: fromPromise(async ({ input }) => {
          spinner.start("Copying the template");
          const result = scaffold({
            templateDir: templateDir(),
            harnessDir: input.claude ? harnessDir() : undefined,
            targetDir: input.targetDir,
            name: input.name,
            blocks: input.blocks,
          });
          spinner.stop(`Created ${input.name} with ${result.blocks.length ? result.blocks.join(", ") : "core only"}`);
          return result.blocks;
        }),
        install: fromPromise(({ input }) => run(...installCommand(pm), input.targetDir)),
        migrate: fromPromise(async ({ input }) => {
          if (hasTables(input.targetDir)) await run(...runCommand(pm, "db:generate"), input.targetDir);
        }),
        git: fromPromise(async ({ input }) => {
          await run("git", ["init", "--quiet"], input.targetDir);
          await run("git", ["add", "-A"], input.targetDir);
        }),
      },
    }),
    { input: plan },
  ).start();
  actor.send({ type: "START" });
  await toPromise(actor);
  const { value, context } = actor.getSnapshot();
  if (value === "failed") {
    p.log.error(context.error ?? "Something failed.");
    process.exitCode = 1;
    return;
  }

  const steps = [
    `cd ${plan.targetDir}`,
    ...(plan.install ? [] : [installCommand(pm).join(" ").replace(",", " ")]),
    ...(context.blocks.includes("d1") ? [`${runCommand(pm, "db:migrate:local").flat().join(" ")}`] : []),
    `${runCommand(pm, "dev").flat().join(" ")}`,
  ];
  p.note(steps.join("\n"), "Next");
  p.outro(`When you're ready to deploy: ${pc.cyan(`${execCommand(pm)} create-tanstack-cf-saas setup`)}`);
};

export const add = (block: string) => {
  const added = addBlock(process.cwd(), templateDir(), block);
  console.log(added.length ? `Added ${added.join(", ")}. Install packages, then run db:generate if a block has tables.` : `${block} is already enabled.`);
};

export const remove = (block: string) => {
  removeBlock(process.cwd(), block);
  console.log(`Removed ${block}. Install packages to drop the ones it used.`);
};

const ICON: Record<Item["state"], string> = { set: pc.green("✓"), missing: pc.red("✗"), unknown: pc.yellow("?"), manual: pc.blue("•") };

const printTable = (items: ReadonlyArray<Item>) => {
  for (const item of items) {
    const need = item.required ? "" : pc.dim(" (optional)");
    const fix = item.state === "set" ? "" : pc.dim(`  → ${item.fix}`);
    console.log(`${ICON[item.state]} ${item.env.padEnd(10)} ${item.name}${need}${fix}`);
  }
};

export interface SetupArgs {
  readonly check: boolean;
  readonly env: string | undefined;
  readonly vars: ReadonlyArray<string>;
  readonly yes: boolean;
}

export const setup = async (args: SetupArgs) => {
  const root = process.cwd();
  const wrangler = projectWrangler(root);
  const loggedIn = wrangler(["whoami"]).ok;
  if (args.check) {
    const items = readiness(root, loggedIn ? wrangler : undefined);
    printTable(items);
    if (!loggedIn) console.log(pc.dim("\nRun `wrangler login` to check secrets too."));
    process.exitCode = isReady(items) ? 0 : 1;
    return;
  }
  if (!loggedIn) throw new Error("Log in first: npx wrangler login");
  p.intro(pc.inverse(" setup "));
  const envs = args.env ? [args.env as EnvName] : envNames;
  const vars = Object.fromEntries(args.vars.map((pair) => [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)]));
  await provision(root, wrangler, {
    envs,
    vars,
    secretValue: async (key, env) => {
      const fromEnv = process.env[key];
      if (fromEnv) return fromEnv;
      if (args.yes || key === "BETTER_AUTH_SECRET") return undefined;
      const value = cancelled(await p.password({ message: `${key} for ${env} (leave empty to skip)` }));
      return value || undefined;
    },
    log: (line) => p.log.step(line),
  });
  p.log.info("Where things stand:");
  printTable(readiness(root, wrangler));
  p.outro("Run setup again any time; it only adds what is missing.");
};

export const harness = (action: string, force: boolean) => {
  const root = process.cwd();
  if (action === "check") {
    const { changed, missing } = harnessStatus(root);
    for (const f of changed) console.log(`${pc.yellow("changed")} .claude/${f}`);
    for (const f of missing) console.log(`${pc.red("missing")} .claude/${f}`);
    if (!changed.length && !missing.length) console.log("The harness matches harness.lock.json.");
    return;
  }
  const { updated, kept } = syncHarness(harnessDir(), root, force);
  console.log(`Updated ${updated.length} file(s).${kept.length ? ` Kept your edits to ${kept.join(", ")} (use --force to replace).` : ""}`);
};
