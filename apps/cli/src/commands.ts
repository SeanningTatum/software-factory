import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";
import {
  addBlock,
  type EnvName,
  loadManifests,
  readProject,
  removeBlock,
  WRANGLER_FILE,
  withRequirements,
} from "@tanstack-cf-saas/blocks";
import pc from "picocolors";
import { createActor, fromPromise, toPromise } from "xstate";
import { type CreatePlan, createMachine } from "./create.machine.ts";
import {
  type Cli,
  DEPLOY_SECRET,
  DEPLOY_SWITCH,
  hasSecret,
  readRulesets,
  requireGh,
  setUrlVariables,
  setupGithub,
} from "./github.ts";
import { harnessStatus, syncHarness } from "./harness.ts";
import { harnessDir, huskyDir, templateDir } from "./paths.ts";
import {
  detectPackageManager,
  installCommand,
  type PackageManager,
  packageManagers,
  runCommand,
} from "./pm.ts";
import { createProjects } from "./posthog.ts";
import { capture, gitIdentity, hasWrangler, projectWrangler, run } from "./run.ts";
import {
  type BlankSetting,
  blankSettings,
  hasTables,
  isEmptyDir,
  nameFromDir,
  namespaceIds,
  parseFeatures,
  scaffold,
  uniqueNamespaceIds,
  validateName,
} from "./scaffold.ts";
import {
  accountId,
  appUrl,
  domainStep,
  firstDeploy,
  type Item,
  isLoggedIn,
  isReady,
  migrate,
  missingSecrets,
  onWorkersDev,
  PRODUCTION_POSTHOG_KEY,
  provision,
  type RunScript,
  readiness,
  setupEnvs,
  typedSettings,
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
  readonly husky: boolean;
  readonly github: boolean;
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
  const husky = await askHusky(args);
  const github = await askGithub(args);
  const devVars = args.yes
    ? {}
    : {
        ...(await askBlankSettings(blankSettings(templateDir(), features))),
        ...(await askPosthog(name)),
      };
  return {
    name,
    targetDir,
    features,
    claude,
    husky,
    github,
    install: args.install,
    git: args.git,
    devVars,
  };
};

/** Whether to add the commit hooks. They are git's, so without git there is nothing to ask. */
const askHusky = async (args: CreateArgs) =>
  !args.git || args.yes || !args.husky
    ? args.git && args.husky
    : cancelled(
        await p.confirm({
          message: "Add husky commit hooks (conventional messages, small commits)?",
          initialValue: true,
        }),
      );

/** Whether to keep `.github/`: the workflows, the rulesets and Dependabot's settings. */
const askGithub = async (args: CreateArgs) =>
  args.yes || !args.github
    ? args.github
    : cancelled(
        await p.confirm({
          message:
            "Add the GitHub workflows and branch rules (.github/: CI, deploys, the promote button)?",
          initialValue: true,
        }),
      );

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

const PROJECT_KEY = /^phc_\S+$/;
const PROJECT_OR_PERSONAL_KEY = /^ph[cx]_\S+$/;

const askPosthogKey = async (message: string, personal = false) =>
  cancelled(
    await p.text({
      message,
      defaultValue: "",
      validate: (v) =>
        !v || (personal ? PROJECT_OR_PERSONAL_KEY : PROJECT_KEY).test(v.trim())
          ? undefined
          : `A project API key starts with phc_ (PostHog → Project settings)${personal ? ", a personal API key with phx_" : ""}`,
    }),
  ).trim();

const askPosthog = async (name: string): Promise<Record<string, string>> => {
  const first = await askPosthogKey(
    "PostHog for staging, which dev reports to as well: its project key (phc_…), or a personal API key (phx_…, scope project:write) to create both projects (leave empty to skip)",
    true,
  );
  if (!first) return {};
  const host = cancelled(
    await p.select({
      message: "Which PostHog cloud?",
      options: [
        { value: "https://us.i.posthog.com", label: "US" },
        { value: "https://eu.i.posthog.com", label: "EU" },
      ],
    }),
  );
  const made = first.startsWith("phx_")
    ? await createProjects(fetch, host, first, name, p.log)
    : { staging: first };
  const staging =
    made.staging ??
    (await askPosthogKey("PostHog project API key for staging (phc_…; leave empty to skip)"));
  if (!staging) return {};
  const production =
    made.production ??
    (await askPosthogKey(
      "PostHog project API key for production, from a project of its own (leave empty to use staging's)",
    ));
  if (!production)
    p.log.warn(
      "Production shares staging's PostHog project, so staging's traffic counts in its numbers.",
    );
  return {
    POSTHOG_KEY: staging,
    [PRODUCTION_POSTHOG_KEY]: production || staging,
    POSTHOG_HOST: host,
  };
};

type Step = "scaffold" | "install" | "migrate" | "git" | "hooks";

const COMMIT_MESSAGE = `chore(scaffold): create project with create-tanstack-cf-saas ${VERSION}`;
const shellPath = (dir: string) => (/\s/.test(dir) ? JSON.stringify(dir) : dir);

/** What is left to run by hand when `failed` broke, in order. */
const stepsLeft = (failed: Step, plan: CreatePlan, pm: PackageManager, hasDb: boolean) => {
  const order: ReadonlyArray<Step> = ["install", "migrate", "git", "hooks"];
  const pending = order.slice(order.indexOf(failed));
  return [
    `cd ${shellPath(plan.targetDir)}`,
    ...(pending.includes("install") && plan.install ? [installCommand(pm).flat().join(" ")] : []),
    ...(pending.includes("migrate") && hasDb
      ? [
          runCommand(pm, "db:generate", "init").flat().join(" "),
          runCommand(pm, "db:migrate:local").flat().join(" "),
        ]
      : []),
    ...(pending.includes("git") && plan.git
      ? [`git init -b staging && git add -A && git commit -m "${COMMIT_MESSAGE}"`]
      : []),
    ...(plan.husky && plan.install ? [runCommand(pm, "prepare").flat().join(" ")] : []),
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
              huskyDir: input.husky ? huskyDir() : undefined,
              github: input.github,
              targetDir: input.targetDir,
              name: input.name,
              features: input.features,
              devVars: input.devVars,
              pm,
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
          if (!hasTables(input.targetDir)) return;
          // db:generate needs a name; a project's first migration is 0000_init.
          await run(...runCommand(pm, "db:generate", "init"), input.targetDir);
          // The local database gets its tables now, so `dev` works straight away.
          migrate(input.targetDir, projectWrangler(input.targetDir), "local", () => {});
        }),
        git: fromPromise(async ({ input }) => {
          step = "git";
          // The shipped workflows deploy staging from `staging` and production from `production`.
          await run("git", ["init", "--quiet", "--initial-branch=staging"], input.targetDir);
          await run("git", ["add", "-A"], input.targetDir);
          await run(
            "git",
            [...gitIdentity(input.targetDir), "commit", "--quiet", "-m", COMMIT_MESSAGE],
            input.targetDir,
          );
          if (!input.husky || !input.install) return;
          // Install ran before there was a repository, so husky set no hooks. Turn them on now,
          // after the first commit, which is far over their line limit.
          step = "hooks";
          await run(...runCommand(pm, "prepare"), input.targetDir);
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
    // With packages installed, create has already migrated the local database.
    ...(context.features.includes("db") && !plan.install
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
  const cloudflare = args.yes ? undefined : await offerCloudflare(plan, context.features, pm);
  // The offer applies the rulesets in .github/, so without them there is nothing to offer.
  if (!args.yes && plan.git && plan.github) await offerGithub(plan);
  printSetupSteps(plan.targetDir, cloudflare);
  printNext(plan.targetDir, steps, pm);
  p.outro(closingLine(cloudflare, pm));
};

const printSetupSteps = (root: string, cloudflare: ReadonlyArray<Item> | undefined) => {
  // The Cloudflare table already lists these steps.
  if (cloudflare) return;
  for (const step of [...loadManifests(root).values()].flatMap((m) => m.setup ?? []))
    p.log.info(`${step.description}${step.help ? pc.dim(` (${step.help})`) : ""}`);
};

/** The last line of create: what setup is still for, or that nothing is left. */
const closingLine = (cloudflare: ReadonlyArray<Item> | undefined, pm: PackageManager) => {
  const setup = pc.cyan(runCommand(pm, "setup").flat().join(" "));
  if (!cloudflare) return `When you're ready to deploy: ${setup}`;
  const skipped = missingSecrets(cloudflare);
  if (skipped.length)
    return `Both are deployed. Not on Cloudflare yet: ${skipped.join(", ")}. Run ${setup} again to upload them.`;
  if (isReady(cloudflare)) return "Staging and production are live.";
  return `Both are deployed. To fill what the table marks missing: ${setup}`;
};

/** Runs a package script in the project with its output captured, for steps that read it. */
const runScript =
  (pm: PackageManager, cwd: string): RunScript =>
  (script) => {
    const [cmd, args] = runCommand(pm, script);
    return capture(cmd, cwd)(args);
  };

/** Asks for an environment's URL; empty keeps its workers.dev address. */
const askUrl = async (env: EnvName) =>
  cancelled(
    await p.text({
      message: `URL of ${env}, if it has its own domain (leave empty to use its workers.dev address)`,
      defaultValue: "",
      validate: (v) => (!v || /^https:\/\/\S+$/.test(v) ? undefined : "Start with https://"),
    }),
  ).trim() || undefined;

/** The closing note: `steps`, then the move to a domain while production is on workers.dev. */
const printNext = (root: string, steps: ReadonlyArray<string>, pm: PackageManager) => {
  const domain = domainStep(root, moveCommand(pm));
  const lines = [...steps, ...(domain ? ["", domain] : [])];
  if (lines.length) p.note(lines.join("\n"), "Next");
};

/** The command that moves production to its own domain, for the closing note. */
const moveCommand = (pm: PackageManager) =>
  runCommand(pm, "setup", "--env", "production", "--var", "APP_URL=https://your-domain")
    .flat()
    .join(" ");

const SETUP_LATER = "Run the project's `setup` script when you are ready.";

/**
 * Offers to create the Cloudflare side now, for staging and production: the resources, the secrets
 * and each environment's URL. What was typed for local use is test data, so it goes to staging and
 * never to production; production's own keys show as missing until `setup --env production`.
 * Returns where things stand once both are deployed, and nothing when setup did not finish.
 */
const offerCloudflare = async (
  plan: CreatePlan,
  features: ReadonlyArray<string>,
  pm: PackageManager,
) => {
  const go = cancelled(
    await p.confirm({
      message:
        "Set up Cloudflare now? Creates the database and storage for staging and production, migrates them, saves your secrets and deploys both (a few minutes).",
      initialValue: true,
    }),
  );
  if (!go) return undefined;
  // Only the project's pinned wrangler gets the keys, never whatever `npx` downloads today.
  if (!hasWrangler(plan.targetDir)) {
    p.log.warn(`Packages aren't installed. ${SETUP_LATER}`);
    return undefined;
  }
  const wrangler = projectWrangler(plan.targetDir);
  if (!isLoggedIn(wrangler)) {
    p.log.warn(`Not logged in to Cloudflare: run \`wrangler login\`. ${SETUP_LATER}`);
    return undefined;
  }
  const blanks = blankSettings(plan.targetDir, features);
  const urls: Partial<Record<EnvName, string>> = {};
  try {
    for (const env of ["staging", "production"] as const) {
      const url = await askUrl(env);
      if (url) urls[env] = url;
      const typed = typedSettings(blanks, plan.devVars, env);
      await provision(plan.targetDir, wrangler, {
        envs: [env],
        vars: typed.vars,
        secretValue: async (key) => typed.secrets[key],
        log: (line) => p.log.step(line),
      });
    }
    firstDeploy(
      plan.targetDir,
      ["staging", "production"],
      runScript(pm, plan.targetDir),
      (line) => p.log.step(line),
      urls,
    );
    p.log.info("Where things stand:");
    const items = readiness(plan.targetDir, wrangler);
    printTable(items);
    return items;
  } catch (error) {
    // The project is already made; setup finishes what is left when run again.
    p.log.warn(`${(error as Error).message}\n${SETUP_LATER}`);
    return undefined;
  } finally {
    // Also after a failure: the ids of what was made must reach the first push, not placeholders.
    if (plan.git) await commitWrangler(plan.targetDir);
  }
};

/** Commits wrangler.jsonc when setup changed it; CI deploys from what is committed. */
const commitWrangler = async (dir: string) => {
  if (!capture("git", dir)(["status", "--porcelain", "--", WRANGLER_FILE]).stdout.trim()) return;
  // Only this file: whatever else is staged is the owner's own work, and not for this commit.
  const commit = [
    "commit",
    "--quiet",
    "-m",
    "chore(setup): record Cloudflare resource ids and URLs",
  ];
  await run("git", [...gitIdentity(dir), ...commit, "--", WRANGLER_FILE], dir);
};

const GITHUB = "create-tanstack-cf-saas github";

/** Offers to create the GitHub repository and its branch rules, so the first push is protected. */
const offerGithub = async (plan: CreatePlan) => {
  const visibility = cancelled(
    await p.select({
      message:
        "Create a GitHub repository with branch rules? staging is the default branch; production moves only to a commit of staging, and deploys it once tagged.",
      options: [
        {
          value: "private" as const,
          label: "Yes, private",
          hint: "rules on a private repository need a paid GitHub plan",
        },
        { value: "public" as const, label: "Yes, public" },
        { value: "skip" as const, label: "Not now", hint: `run \`${GITHUB}\` later` },
      ],
    }),
  );
  if (visibility === "skip") return;
  try {
    const gh = capture("gh", plan.targetDir);
    requireGh(gh); // before the token question, so a typed token is never thrown away
    const missing = setupGithub(plan.targetDir, gh, capture("git", plan.targetDir), {
      name: () => plan.name,
      visibility,
      deploy: await deployInputs(plan.targetDir, gh, false),
      log: (line) => p.log.step(line),
    });
    printMissing(missing);
  } catch (error) {
    // The project is already made; the command finishes what is left when run again.
    p.log.warn(`${(error as Error).message}\nRun \`${GITHUB}\` in the project to try again.`);
  }
};

/** Feature names from the command line (`kv workflows` or `kv,workflows`), old block names mapped and noted. */
const featureArgs = (args: ReadonlyArray<string>) => {
  const { features, notes } = parseFeatures(args.flatMap((arg) => arg.split(",")));
  for (const note of notes) console.log(note);
  if (!features.length) throw new Error("Name a feature.");
  return features;
};

export const add = (...names: ReadonlyArray<string>) => {
  const features = featureArgs(names);
  const root = process.cwd();
  readProject(root);
  // Checked before the first one is copied, so a mistyped name leaves nothing half added.
  const known = loadManifests(templateDir());
  const unknown = features.filter((f) => !known.has(f));
  if (unknown.length) throw new Error(`Unknown feature(s): ${unknown.join(", ")}`);
  const git = capture("git", root);
  const before = git(["status", "--porcelain"]);
  const hooked = existsSync(join(root, ".husky/pre-commit"));
  const ids = namespaceIds(root);
  const added = features.flatMap((f) => addBlock(root, templateDir(), f));
  // A new limiter arrives with its manifest's id, the same in every project; see `create`.
  uniqueNamespaceIds(root, ids);
  resetHistory(root, added, `- ${today()} — Added with create-tanstack-cf-saas ${VERSION}.`);
  if (!added.length) {
    console.log(`Already on: ${features.join(", ")}.`);
    return;
  }
  // A feature is far over the size hook's limit, and none of it is the owner's writing. From a
  // clean tree the commit holds the scaffolding and nothing else, so it alone may skip the hook.
  const clean = before.ok && !before.stdout.trim();
  if (hooked && clean) commitScaffold(root, git, added);
  console.log(
    `Added ${added.join(", ")}${hooked && clean ? ", in a commit of its own" : ""}. Install packages, then run db:generate <name> (say, add_${added[0]}) if a feature has tables.`,
  );
  if (hooked && !clean)
    console.log(
      "Not committed: other work was uncommitted. The size hook counts this scaffolding, so commit it in steps; from a clean tree, `add` commits it for you.",
    );
};

const commitScaffold = (root: string, git: Cli, added: ReadonlyArray<string>) => {
  const message = `feat(scaffold): add ${added.join(", ")} with create-tanstack-cf-saas ${VERSION}`;
  for (const args of [
    ["add", "-A"],
    [...gitIdentity(root), "commit", "--quiet", "--no-verify", "-m", message],
  ]) {
    const result = git(args);
    if (!result.ok) throw new Error(`git ${args[0]} failed:\n${result.stderr.trim()}`);
  }
};

export const remove = (names: ReadonlyArray<string>, force = false) => {
  const features = featureArgs(names);
  const root = process.cwd();
  readProject(root);
  for (const feature of features) removeBlock(root, feature, { force });
  console.log(
    `Removed ${features.join(", ")}. Install packages to drop the ones it used. If it had tables, the next db:generate writes DROP TABLE for them: read that migration before you apply it.`,
  );
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
  migrate(root, wrangler, "local", (line) => p.log.step(line));
  // A URL is given with --env, so it belongs to the one environment named.
  const { APP_URL: url, ...rest } = vars;
  const urls = await setupUrls(root, envs, url, !args.yes && process.stdin.isTTY);
  await provision(root, wrangler, {
    envs,
    vars: rest,
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
  const pm = detectPackageManager();
  const recorded = firstDeploy(root, envs, runScript(pm, root), (line) => p.log.step(line), urls);
  const changed = Object.keys(recorded).length > 0;
  if (changed) setGithubUrls(root, recorded);
  p.log.info("Where things stand:");
  printTable(readiness(root, wrangler));
  printNext(root, [], pm);
  p.outro(
    changed
      ? `${WRANGLER_FILE} now holds each new APP_URL. Commit it and merge it into staging before the next promotion: CI deploys what staging holds.`
      : "Run setup again any time; it only adds what is missing.",
  );
};

/**
 * Each environment's URL for this run: the one `--var APP_URL` gave, else, at a terminal, one
 * asked for while the environment has none or is on workers.dev.
 */
const setupUrls = async (
  root: string,
  envs: ReadonlyArray<EnvName>,
  given: string | undefined,
  canAsk: boolean,
) => {
  const urls: Partial<Record<EnvName, string>> = given && envs[0] ? { [envs[0]]: given } : {};
  if (!canAsk) return urls;
  for (const env of envs) {
    const recorded = appUrl(root, env);
    if (urls[env] || (recorded && !onWorkersDev(recorded))) continue;
    const asked = await askUrl(env);
    if (asked) urls[env] = asked;
  }
  return urls;
};

/** Gives GitHub the URLs setup just recorded, when the project has a repository there. */
const setGithubUrls = (root: string, urls: Partial<Record<EnvName, string>>) => {
  if (!capture("git", root)(["remote", "get-url", "origin"]).ok) return;
  const gh = capture("gh", root);
  try {
    requireGh(gh);
    setUrlVariables(gh, urls, (line) => p.log.step(line));
  } catch (error) {
    p.log.warn(`${(error as Error).message}\nRun \`${GITHUB}\` to update GitHub's URL variables.`);
  }
};

/** How to supply each setting deploy.yml needs, for the ones `github` could not work out. */
const DEPLOY_FIX: Readonly<Record<string, string>> = {
  [DEPLOY_SWITCH]:
    "held back until the staging URL and the token are set, because it switches the deploys on. If it is the only one listed, run `wrangler login` or set it in your shell",
  STAGING_URL: "run `setup --env staging --var APP_URL=https://...`",
  PRODUCTION_URL: "run `setup --env production --var APP_URL=https://...`",
  [DEPLOY_SECRET]: "run `gh secret set CLOUDFLARE_API_TOKEN`",
};

/**
 * What deploy.yml needs from this machine: the Cloudflare account, the two URLs and the token. The
 * URLs are each environment's APP_URL, because /api/health refuses any other. Nothing is guessed.
 */
const deployInputs = async (root: string, gh: Cli, hasRepository: boolean) => {
  if (!existsSync(join(root, WRANGLER_FILE))) return undefined; // not made from the template
  const variables = {
    [DEPLOY_SWITCH]: process.env.CLOUDFLARE_ACCOUNT_ID || accountId(projectWrangler(root)),
    STAGING_URL: appUrl(root, "staging"),
    PRODUCTION_URL: appUrl(root, "production"),
  };
  // Asked for, never taken from the shell: a token there may be wider than CI should hold.
  const token =
    (hasRepository && hasSecret(gh, DEPLOY_SECRET)) || !process.stdin.isTTY
      ? undefined
      : cancelled(
          await p.password({
            message: `Cloudflare API token for GitHub Actions to deploy with (${DEPLOY_SECRET}; leave empty to skip)`,
          }),
        ) || undefined;
  return { variables, token };
};

/** Names what deploy.yml still lacks and how to supply each; until then its jobs skip. */
const printMissing = (missing: ReadonlyArray<string>) => {
  if (!missing.length) return;
  console.log(
    pc.yellow("\nGitHub Actions can't deploy until these are set. Then run `github` again:"),
  );
  for (const name of missing) console.log(`  ${name}: ${DEPLOY_FIX[name]}`);
};

export const github = async (isPublic: boolean) => {
  const root = process.cwd();
  const gh = capture("gh", root);
  const git = capture("git", root);
  // Both before the token question, so a typed token is never thrown away.
  readRulesets(root);
  requireGh(gh);
  const missing = setupGithub(root, gh, git, {
    name: () => readProject(root).name,
    visibility: isPublic ? "public" : "private",
    deploy: await deployInputs(root, gh, git(["remote", "get-url", "origin"]).ok),
    log: console.log,
  });
  printMissing(missing);
  console.log(
    "\nTo ship: git fetch origin && git push --atomic origin origin/staging:refs/tags/v0.1.0 origin/staging:refs/heads/production (docs/branches.md says why).",
  );
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
    if (changed.length || missing.length) process.exitCode = 1;
    return;
  }
  const { updated, kept } = syncHarness(harnessDir(), root, force);
  console.log(
    `Updated ${updated.length} file(s).${kept.length ? ` Kept your edits to ${kept.join(", ")} (use --force to replace).` : ""}`,
  );
};
