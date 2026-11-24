import { resolve } from "node:path";
import * as p from "@clack/prompts";
import {
  addBlock,
  type EnvName,
  envNames,
  loadManifests,
  removeBlock,
  withRequirements,
} from "@tanstack-cf-saas/blocks";
import pc from "picocolors";
import { createActor, fromPromise, toPromise } from "xstate";
import { type CreatePlan, createMachine } from "./create.machine.ts";
import { harnessStatus, syncHarness } from "./harness.ts";
import { harnessDir, templateDir } from "./paths.ts";
import {
  detectPackageManager,
  execCommand,
  installCommand,
  type PackageManager,
  packageManagers,
  runCommand,
} from "./pm.ts";
import { projectWrangler, run } from "./run.ts";
import { hasTables, isEmptyDir, parseFeatures, scaffold, validateName } from "./scaffold.ts";
import { type Item, isReady, provision, readiness } from "./setup.ts";
import { resetHistory, today } from "./timeline.ts";
import { VERSION } from "./version.ts";

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
  readonly features: string | undefined;
  readonly pm: string | undefined;
  readonly yes: boolean;
  readonly claude: boolean;
  readonly install: boolean;
  readonly git: boolean;
}

const featureOptions = () =>
  [...loadManifests(templateDir()).values()]
    .filter((m) => !m.core)
    .map((m) => ({
      value: m.name,
      label: m.title,
      hint: m.requires.length ? `needs ${m.requires.join(", ")}` : m.description,
    }));

const askPlan = async (args: CreateArgs): Promise<CreatePlan> => {
  const dirArg =
    args.dir ??
    (args.yes
      ? "my-saas"
      : cancelled(
          await p.text({
            message: "Where should the project go?",
            placeholder: "my-saas",
            defaultValue: "my-saas",
          }),
        ));
  const targetDir = resolve(dirArg);
  if (!isEmptyDir(targetDir)) throw new Error(`${targetDir} is not empty.`);
  const fallbackName =
    dirArg
      .split("/")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9-]/g, "-") || "my-saas";
  const name =
    args.name ??
    (args.yes
      ? fallbackName
      : cancelled(
          await p.text({
            message: "Project name",
            defaultValue: fallbackName,
            placeholder: fallbackName,
            validate: (v) => validateName(v || fallbackName),
          }),
        ));
  const manifests = loadManifests(templateDir());
  const parsed =
    args.features !== undefined
      ? parseFeatures(args.features)
      : args.yes
        ? parseFeatures(["db", "auth", "billing"])
        : parseFeatures(
            cancelled(
              await p.multiselect({
                message: "Features (the core ones are always on)",
                options: featureOptions(),
                initialValues: ["db", "auth"],
                required: false,
              }),
            ),
          );
  for (const note of parsed.notes) p.log.warn(note);
  const chosen = parsed.features;
  const unknown = chosen.filter((f) => !manifests.has(f));
  if (unknown.length)
    throw new Error(
      `Unknown feature(s): ${unknown.join(", ")}. Choose from: ${featureOptions()
        .map((o) => o.value)
        .join(", ")}`,
    );
  const features = withRequirements(manifests, chosen).filter((f) => !manifests.get(f)?.core);
  const added = features.filter((f) => !chosen.includes(f));
  if (added.length) p.log.info(`Also adding ${added.join(", ")}, which ${chosen.join(", ")} need.`);
  const claude =
    args.yes || !args.claude
      ? args.claude
      : cancelled(
          await p.confirm({ message: "Add the Claude workflows (.claude/)?", initialValue: true }),
        );
  return { name, targetDir, features, claude, install: args.install, git: args.git };
};

export const create = async (args: CreateArgs) => {
  p.intro(pc.inverse(" create-tanstack-cf-saas "));
  const plan = await askPlan(args);
  const pm = (
    packageManagers.includes(args.pm as PackageManager) ? args.pm : detectPackageManager()
  ) as PackageManager;
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
            features: input.features,
          });
          spinner.stop(
            `Created ${input.name} with ${result.features.length ? result.features.join(", ") : "the core features only"}`,
          );
          return result.features;
        }),
        install: fromPromise(({ input }) => run(...installCommand(pm), input.targetDir)),
        migrate: fromPromise(async ({ input }) => {
          if (hasTables(input.targetDir))
            await run(...runCommand(pm, "db:generate"), input.targetDir);
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
    ...(context.features.includes("db")
      ? [`${runCommand(pm, "db:migrate:local").flat().join(" ")}`]
      : []),
    `${runCommand(pm, "dev").flat().join(" ")}`,
  ];
  p.note(steps.join("\n"), "Next");
  p.outro(
    `When you're ready to deploy: ${pc.cyan(`${execCommand(pm)} create-tanstack-cf-saas setup`)}`,
  );
};

/** One feature name from the command line, with old block names mapped and noted. */
const featureArg = (arg: string) => {
  const { features, notes } = parseFeatures([arg]);
  for (const note of notes) console.log(note);
  const [feature] = features;
  if (!feature) throw new Error("Name a feature.");
  return feature;
};

export const add = (arg: string) => {
  const feature = featureArg(arg);
  const root = process.cwd();
  const added = addBlock(root, templateDir(), feature);
  resetHistory(root, added, `- ${today()} — Added with create-tanstack-cf-saas ${VERSION}.`);
  console.log(
    added.length
      ? `Added ${added.join(", ")}. Install packages, then run db:generate if a feature has tables.`
      : `${feature} is already on.`,
  );
};

export const remove = (arg: string) => {
  const feature = featureArg(arg);
  removeBlock(process.cwd(), feature);
  console.log(`Removed ${feature}. Install packages to drop the ones it used.`);
};

const ICON: Record<Item["state"], string> = {
  set: pc.green("✓"),
  missing: pc.red("✗"),
  unknown: pc.yellow("?"),
  manual: pc.blue("•"),
};

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
  const vars = Object.fromEntries(
    args.vars.map((pair) => [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)]),
  );
  await provision(root, wrangler, {
    envs,
    vars,
    secretValue: async (key, env) => {
      const fromEnv = process.env[key];
      if (fromEnv) return fromEnv;
      if (args.yes || key === "BETTER_AUTH_SECRET") return undefined;
      const value = cancelled(
        await p.password({ message: `${key} for ${env} (leave empty to skip)` }),
      );
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
  console.log(
    `Updated ${updated.length} file(s).${kept.length ? ` Kept your edits to ${kept.join(", ")} (use --force to replace).` : ""}`,
  );
};
