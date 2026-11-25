import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";
import {
  addBlock,
  loadManifests,
  readProject,
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
import { gitIdentity, projectWrangler, run } from "./run.ts";
import {
  type BlankSetting,
  blankSettings,
  hasTables,
  isEmptyDir,
  nameFromDir,
  parseFeatures,
  scaffold,
  validateName,
} from "./scaffold.ts";
import {
  type Item,
  isLoggedIn,
  isReady,
  provision,
  putSecret,
  readiness,
  setupEnvs,
} from "./setup.ts";
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
    .filter((m) => !m.required)
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
  const fallbackName = nameFromDir(targetDir);
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
  const badName = validateName(name);
  if (badName) throw new Error(`"${name}": ${badName}`);
  const manifests = loadManifests(templateDir());
  const parsed =
    args.features !== undefined
      ? parseFeatures(args.features)
      : args.yes
        ? parseFeatures(["db", "auth", "billing"])
        : parseFeatures(
            cancelled(
              await p.multiselect({
                message: "Features (the required ones are always on)",
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
  const features = withRequirements(manifests, chosen).filter((f) => !manifests.get(f)?.required);
  const added = features.filter((f) => !chosen.includes(f));
  if (added.length) p.log.info(`Also adding ${added.join(", ")}, which ${chosen.join(", ")} need.`);
  const claude =
    args.yes || !args.claude
      ? args.claude
      : cancelled(
          await p.confirm({ message: "Add the Claude workflows (.claude/)?", initialValue: true }),
        );
  const devVars = args.yes ? {} : await askBlankSettings(blankSettings(templateDir(), features));
  return { name, targetDir, features, claude, install: args.install, git: args.git, devVars };
};

/** Asks for each setting a chosen feature needs; an empty answer leaves it for .dev.vars later. */
const askBlankSettings = async (blanks: ReadonlyArray<BlankSetting>) => {
  if (!blanks.length) return {};
  const features = [...new Set(blanks.map((b) => b.feature))].join(", ");
  p.log.info(
    `${features} won't work until these are set. Leave one empty to fill it in .dev.vars later.`,
  );
  const values: Record<string, string> = {};
  for (const blank of blanks) {
    const message = `${blank.key}: ${blank.description}${blank.help ? ` (${blank.help})` : ""}`;
    const value = cancelled(
      await (blank.secret ? p.password({ message }) : p.text({ message, defaultValue: "" })),
    ).trim();
    if (value) values[blank.key] = value;
  }
  return values;
};

type Step = "scaffold" | "install" | "migrate" | "git";

const COMMIT_MESSAGE = `chore: create project with create-tanstack-cf-saas ${VERSION}`;
const shellPath = (dir: string) => (/\s/.test(dir) ? JSON.stringify(dir) : dir);

/** What is left to run by hand when `failed` broke, in order. */
const stepsLeft = (failed: Step, plan: CreatePlan, pm: PackageManager, hasDb: boolean) => {
  const order: ReadonlyArray<Step> = ["install", "migrate", "git"];
  const pending = order.slice(order.indexOf(failed));
  return [
    `cd ${shellPath(plan.targetDir)}`,
    ...(pending.includes("install") && plan.install ? [installCommand(pm).flat().join(" ")] : []),
    ...(pending.includes("migrate") && hasDb
      ? [runCommand(pm, "db:generate").flat().join(" ")]
      : []),
    ...(pending.includes("git") && plan.git
      ? [`git init && git add -A && git commit -m "${COMMIT_MESSAGE}"`]
      : []),
  ];
};

export const create = async (args: CreateArgs) => {
  p.intro(pc.inverse(" create-tanstack-cf-saas "));
  const plan = await askPlan(args);
  const known = packageManagers.includes(args.pm as PackageManager);
  if (args.pm !== undefined && !known) {
    p.log.warn(`Unknown package manager "${args.pm}"; use ${packageManagers.join(", ")}.`);
  }
  const pm = known ? (args.pm as PackageManager) : detectPackageManager();
  const spinner = p.spinner();
  let step: Step = "scaffold";

  const actor = createActor(
    createMachine.provide({
      actors: {
        scaffold: fromPromise(async ({ input }) => {
          spinner.start("Copying the template");
          try {
            const result = scaffold({
              templateDir: templateDir(),
              harnessDir: input.claude ? harnessDir() : undefined,
              targetDir: input.targetDir,
              name: input.name,
              features: input.features,
              devVars: input.devVars,
            });
            spinner.stop(
              `Created ${input.name} with ${result.features.length ? result.features.join(", ") : "the required features only"}`,
            );
            return result.features;
          } catch (error) {
            // A running spinner keeps Node alive, so the process would never exit.
            spinner.error("Could not copy the template");
            throw error;
          }
        }),
        install: fromPromise(({ input }) => {
          step = "install";
          return run(...installCommand(pm), input.targetDir);
        }),
        migrate: fromPromise(async ({ input }) => {
          step = "migrate";
          if (hasTables(input.targetDir))
            await run(...runCommand(pm, "db:generate"), input.targetDir);
        }),
        git: fromPromise(async ({ input }) => {
          step = "git";
          await run("git", ["init", "--quiet"], input.targetDir);
          await run("git", ["add", "-A"], input.targetDir);
          await run(
            "git",
            [...gitIdentity(input.targetDir), "commit", "--quiet", "-m", COMMIT_MESSAGE],
            input.targetDir,
          );
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
    if (step === "scaffold") {
      p.log.info(`${plan.targetDir} may hold a partial copy; delete it before you try again.`);
    } else {
      p.note(
        stepsLeft(step, plan, pm, context.features.includes("db")).join("\n"),
        `The project is in ${plan.targetDir}. Still to do`,
      );
    }
    process.exitCode = 1;
    return;
  }

  const steps = [
    `cd ${shellPath(plan.targetDir)}`,
    ...(plan.install ? [] : [installCommand(pm).flat().join(" ")]),
    ...(context.features.includes("db")
      ? [runCommand(pm, "db:migrate:local").flat().join(" ")]
      : []),
    runCommand(pm, "dev").flat().join(" "),
  ];
  const unset = blankSettings(plan.targetDir, context.features).filter(
    (b) => !plan.devVars?.[b.key],
  );
  for (const feature of new Set(unset.map((b) => b.feature)))
    p.log.warn(
      `${feature} is off until you set ${unset
        .filter((b) => b.feature === feature)
        .map((b) => b.key)
        .join(", ")} in .dev.vars.`,
    );
  if (!args.yes) await saveSecretsToCloudflare(plan, context.features);
  p.note(steps.join("\n"), "Next");
  p.outro(
    `When you're ready to deploy: ${pc.cyan(`${execCommand(pm)} create-tanstack-cf-saas setup`)}`,
  );
};

/** Offers to put the secrets typed during `create` into Cloudflare too, so a deploy has them. */
const saveSecretsToCloudflare = async (plan: CreatePlan, features: ReadonlyArray<string>) => {
  const secrets = blankSettings(plan.targetDir, features).flatMap((b) => {
    const value = b.secret ? plan.devVars?.[b.key] : undefined;
    return value ? [{ key: b.key, value }] : [];
  });
  if (!secrets.length) return;
  const env = cancelled(
    await p.select({
      message: `Also save ${secrets.map((s) => s.key).join(", ")} to Cloudflare (wrangler secret put)?`,
      options: [
        { value: "staging", label: "Yes, to staging", hint: "where test keys belong" },
        { value: "production", label: "Yes, to production" },
        { value: "skip", label: "Not now", hint: "setup asks again before you deploy" },
      ],
    }),
  );
  if (env === "skip") return;
  // Only the project's pinned wrangler gets the keys, never whatever `npx` downloads today.
  if (!existsSync(join(plan.targetDir, "node_modules/.bin/wrangler"))) {
    p.log.warn(`Packages aren't installed. Install them, then run \`setup --env ${env}\`.`);
    return;
  }
  const wrangler = projectWrangler(plan.targetDir);
  if (!isLoggedIn(wrangler)) {
    p.log.warn(`Not logged in to Cloudflare. Run \`wrangler login\`, then \`setup --env ${env}\`.`);
    return;
  }
  try {
    for (const { key, value } of secrets) {
      putSecret(wrangler, key, env, value);
      p.log.step(`secret ${key} (${env}): set`);
    }
    const vars = blankSettings(plan.targetDir, features).flatMap((b) => {
      const value = b.secret ? undefined : plan.devVars?.[b.key];
      return value ? [`--var ${b.key}=${value}`] : [];
    });
    if (vars.length)
      p.log.info(`Save the other settings with \`setup --env ${env} ${vars.join(" ")}\`.`);
  } catch (error) {
    // The project is already made; a failed put is something setup can finish later.
    p.log.warn(`${(error as Error).message}\nRun \`setup --env ${env}\` to try again.`);
  }
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
  readProject(root);
  const added = addBlock(root, templateDir(), feature);
  resetHistory(root, added, `- ${today()} — Added with create-tanstack-cf-saas ${VERSION}.`);
  console.log(
    added.length
      ? `Added ${added.join(", ")}. Install packages, then run db:generate if a feature has tables.`
      : `${feature} is already on.`,
  );
};

/** Uncommitted changes under `paths`, or undefined when git can't tell (not a repository). */
const uncommitted = (root: string, paths: ReadonlyArray<string>) => {
  const status = spawnSync("git", ["status", "--porcelain", "--", ...paths], {
    cwd: root,
    encoding: "utf8",
  });
  return status.status === 0 ? status.stdout.trim() : undefined;
};

export const remove = (arg: string, force = false) => {
  const feature = featureArg(arg);
  const root = process.cwd();
  readProject(root);
  const manifest = loadManifests(root).get(feature);
  if (manifest && !force) {
    // What removeBlock deletes: the feature's folder and the files its manifest lists.
    const changes = uncommitted(root, [manifest.dir, ...(manifest.files ?? [])]);
    if (changes === undefined)
      throw new Error(
        `Can't tell whether ${feature} has uncommitted work: this is not a git repository. Pass --force to remove it anyway.`,
      );
    if (changes)
      throw new Error(
        `${feature} has uncommitted changes, which removing it would delete:\n${changes}\nCommit or stash them, or pass --force.`,
      );
  }
  removeBlock(root, feature);
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
  readProject(root);
  const wrangler = projectWrangler(root);
  const loggedIn = isLoggedIn(wrangler);
  if (args.check) {
    const items = readiness(root, loggedIn ? wrangler : undefined);
    printTable(items);
    if (!loggedIn) console.log(pc.dim("\nRun `wrangler login` to check secrets too."));
    process.exitCode = isReady(items) ? 0 : 1;
    return;
  }
  const vars = Object.fromEntries(
    args.vars.map((pair) => [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)]),
  );
  const fromEnv = [...loadManifests(root).values()]
    .flatMap((m) => Object.keys(m.secrets ?? {}))
    .filter((key) => process.env[key]);
  const envs = setupEnvs(args.env, [...Object.keys(vars).map((k) => `--var ${k}`), ...fromEnv]);
  if (!loggedIn) throw new Error("Log in first: npx wrangler login");
  p.intro(pc.inverse(" setup "));
  await provision(root, wrangler, {
    envs,
    vars,
    secretValue: async (key, env, isSet) => {
      const value = process.env[key];
      if (value) return value;
      if (args.yes || isSet || key === "BETTER_AUTH_SECRET") return undefined;
      const typed = cancelled(
        await p.password({ message: `${key} for ${env} (leave empty to skip)` }),
      );
      return typed || undefined;
    },
    log: (line) => p.log.step(line),
  });
  p.log.info("Where things stand:");
  printTable(readiness(root, wrangler));
  p.outro("Run setup again any time; it only adds what is missing.");
};

export const harness = (action: string, force: boolean) => {
  const root = process.cwd();
  if (action !== "check" && action !== "sync")
    throw new Error(`Unknown action "${action}". Use check or sync.`);
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
