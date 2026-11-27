import * as p from "@clack/prompts";
import { type EnvName, loadManifests, WRANGLER_FILE } from "@seanningtatum/software-factory-blocks";
import pc from "picocolors";
import { createActor, fromPromise, toPromise } from "xstate";
import {
  askUrl,
  deployInputs,
  GITHUB,
  printMissing,
  printNext,
  printTable,
  runScript,
  setupIssues,
} from "./commands.ts";
import { type CreatePlan, createMachine } from "./create.machine.ts";
import { requireGh, setupGithub } from "./github.ts";
import { harnessDir, huskyDir, templateDir } from "./paths.ts";
import {
  detectPackageManager,
  installCommand,
  type PackageManager,
  packageManagers,
  runCommand,
} from "./pm.ts";
import { capture, gitIdentity, hasWrangler, projectWrangler, run } from "./run.ts";
import { blankSettings, hasTables, scaffold } from "./scaffold.ts";
import {
  firstDeploy,
  type Item,
  isLoggedIn,
  isReady,
  migrate,
  missingSecrets,
  provision,
  readiness,
  typedSettings,
} from "./setup.ts";
import { VERSION } from "./version.ts";
import { askPlan, type CreateArgs, cancelled } from "./wizard.ts";

type Step = "scaffold" | "install" | "migrate" | "git" | "hooks";

const COMMIT_MESSAGE = `chore(scaffold): create project with create-software-factory ${VERSION}`;
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
  p.intro(pc.inverse(" create-software-factory "));
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
    ...foundationStep(plan.claude),
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

const foundationStep = (claude: boolean) =>
  claude ? ["", "Before you build: open Claude Code here and run /foundation."] : [];

const printSetupSteps = (root: string, cloudflare: ReadonlyArray<Item> | undefined) => {
  // The Cloudflare table already lists these steps.
  if (cloudflare) return;
  const steps = [...loadManifests(root).values()].flatMap((m) => m.setup ?? []);
  if (steps.length)
    p.log.warn(`Still to do by hand before you go live (\`${GITHUB}\` opens an issue for each):`);
  for (const step of steps)
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
    // A refused commit must not end create here, before it says what was made.
    if (plan.git)
      await commitWrangler(plan.targetDir).catch((error: Error) =>
        p.log.warn(
          `${error.message}\nCommit ${WRANGLER_FILE} yourself: it holds the ids of what was made.`,
        ),
      );
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
      issues: setupIssues(plan.targetDir),
      log: (line) => p.log.step(line),
    });
    printMissing(missing);
  } catch (error) {
    // The project is already made; the command finishes what is left when run again.
    p.log.warn(`${(error as Error).message}\nRun \`${GITHUB}\` in the project to try again.`);
  }
};
