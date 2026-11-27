import { resolve } from "node:path";
import * as p from "@clack/prompts";
import { loadManifests, withRequirements } from "@seanningtatum/software-factory-blocks";
import type { CreatePlan } from "./create.machine.ts";
import { templateDir } from "./paths.ts";
import { createProjects } from "./posthog.ts";
import {
  type BlankSetting,
  blankSettings,
  isEmptyDir,
  missedAuto,
  nameFromDir,
  parseFeatures,
  validateName,
} from "./scaffold.ts";
import { PRODUCTION_POSTHOG_KEY } from "./setup.ts";

export const cancelled = <T>(value: T): Exclude<T, symbol> => {
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
    .filter((m) => !m.required && !m.auto)
    .map((m) => ({
      value: m.name,
      label: m.title,
      hint: m.requires.length ? `needs ${m.requires.join(", ")}` : m.description,
    }));

/** Says what the choice pulled in, and what a half-chosen auto feature would have added. */
const explainFeatures = (
  manifests: ReturnType<typeof loadManifests>,
  chosen: ReadonlyArray<string>,
  features: ReadonlyArray<string>,
) => {
  const added = features.filter((f) => !chosen.includes(f));
  if (added.length) p.log.info(`Also adding ${added.join(", ")}, which ${chosen.join(", ")} need.`);
  for (const note of missedAuto(manifests, features)) p.log.warn(note);
};

export const askPlan = async (args: CreateArgs): Promise<CreatePlan> => {
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
  explainFeatures(manifests, chosen, features);
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

/** Masked when a personal key may be typed: it can change every project in the organization. */
const askPosthogKey = async (message: string, personal = false) => {
  const validate = (v: string | undefined) =>
    !v || (personal ? PROJECT_OR_PERSONAL_KEY : PROJECT_KEY).test(v.trim())
      ? undefined
      : `A project API key starts with phc_ (PostHog → Project settings)${personal ? ", a personal API key with phx_" : ""}`;
  const answer = personal
    ? await p.password({ message, validate })
    : await p.text({ message, defaultValue: "", validate });
  return (cancelled(answer) ?? "").trim();
};

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
