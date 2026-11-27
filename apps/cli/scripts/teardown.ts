/**
 * Deletes everything a project made by `bun run try` left outside this machine, then its folder:
 * its two Workers, the D1 databases and KV namespaces `setup` recorded in wrangler.jsonc, its R2
 * buckets and Workflows, and its GitHub repository. For testing the CLI; it is not shipped. It lists what it will delete and asks for
 * the project's name first.
 *
 *   bun run teardown                      the default try folder, ../cf-saas-try
 *   bun run teardown ../my-app            another project
 *   bun run teardown ../my-app --keep     leave the folder
 *   bun run teardown ../my-app --yes      ask nothing
 */
import { existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  type Binding,
  type EnvName,
  envNames,
  loadManifests,
  PLACEHOLDER_D1_ID,
  PLACEHOLDER_KV_ID,
  readBinding,
  readProject,
  resourceName,
  WRANGLER_FILE,
} from "@tanstack-cf-saas/blocks";
import { parse } from "jsonc-parser";
import type { Cli } from "../src/github.ts";
import { capture, projectWrangler } from "../src/run.ts";
import { envFlag } from "../src/setup.ts";
import { repo } from "./pack.ts";

export interface Step {
  readonly label: string;
  readonly tool: "wrangler" | "gh";
  readonly args: ReadonlyArray<string>;
}

/**
 * The project's own GitHub repository, as owner/name. Undefined unless the folder is the top of
 * its own git checkout: inside another checkout, `origin` would be that one's repository.
 */
export const ownRepository = (root: string, git: Cli): string | undefined => {
  const top = git(["rev-parse", "--show-toplevel"]);
  if (!top.ok || realpathSync(top.stdout.trim()) !== realpathSync(root)) return undefined;
  const url = git(["remote", "get-url", "origin"]);
  return url.ok
    ? /github\.com[:/](\S+)$/.exec(url.stdout.trim())?.[1]?.replace(/\.git$/, "")
    : undefined;
};

/** Wrangler's flag for an environment: production is the top level, so it has none. */
const wrangler = (label: string, ...args: Array<string>): Step => ({
  label,
  tool: "wrangler",
  args,
});

/** Whether wrangler.jsonc holds an id `setup` recorded, not the placeholder a new project has. */
const recorded = (id: unknown, placeholder: string): id is string =>
  typeof id === "string" && id !== placeholder;

/**
 * The delete for one binding's resource. A database or namespace is deleted only when setup
 * recorded its id: wrangler reads a database's id from wrangler.jsonc before it asks Cloudflare, so
 * a placeholder there would be sent as the id to delete.
 */
const resourceSteps = (b: Binding, text: string, env: EnvName, project: string): Array<Step> => {
  if (b.type === "d1") {
    const id = readBinding(text, env, "d1_databases", b.binding)?.database_id;
    const name = resourceName(b.database, project, env);
    return recorded(id, PLACEHOLDER_D1_ID)
      ? [wrangler(`D1 ${name}`, "d1", "delete", name, "-y", ...envFlag(env))]
      : [];
  }
  if (b.type === "kv") {
    const id = readBinding(text, env, "kv_namespaces", b.binding)?.id;
    const name = resourceName(b.namespace, project, env);
    return recorded(id, PLACEHOLDER_KV_ID)
      ? [wrangler(`KV ${name}`, "kv", "namespace", "delete", "--namespace-id", id, "-y")]
      : [];
  }
  if (b.type === "r2") {
    const name = resourceName(b.bucket, project, env);
    return [wrangler(`R2 ${name}`, "r2", "bucket", "delete", name)];
  }
  if (b.type === "workflow") {
    // A Workflow outlives the Worker that defines it.
    const name = resourceName(b.name, project, env);
    return [wrangler(`Workflow ${name}`, "workflows", "delete", name)];
  }
  return [];
};

/** Every delete, in order: Workers first, so nothing still holds the resources below them. */
export const teardownPlan = (root: string, repository: string | undefined): Array<Step> => {
  const project = readProject(root).name;
  const text = readFileSync(join(root, WRANGLER_FILE), "utf8");
  const worker = (parse(text) as { name: string }).name;
  const bindings = [...loadManifests(root).values()].flatMap((m) => m.bindings ?? []);
  const workers = envNames.map((env) => {
    const name = env === "production" ? worker : `${worker}-${env}`;
    return wrangler(`Worker ${name}`, "delete", name, "--force");
  });
  const resources = envNames.flatMap((env) =>
    bindings.flatMap((b) => resourceSteps(b, text, env, project)),
  );
  const github: Array<Step> = repository
    ? [
        {
          label: `GitHub repository ${repository}`,
          tool: "gh",
          args: ["repo", "delete", repository, "--yes"],
        },
      ]
    : [];
  return [...workers, ...resources, ...github];
};

/** Whether a failed delete says the thing was never there. Cloudflare writes `not_found` too. */
export const isGone = (said: string) =>
  /not[ _](be )?found|does not exist|doesn't exist|couldn't find|could not find|\b404\b/i.test(
    said,
  );

/** What a failed command said, without wrangler's banner and log-file lines, which come last. */
export const lastWords = (said: string) =>
  said
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/Logs were written to|⛅️|^[─-]+$/.test(line))
    .slice(-3)
    .join(" | ");

/** The Cloudflare accounts wrangler will delete from, by name, so the wrong one is seen in time. */
const cloudflareAccounts = (root: string): string => {
  const who = projectWrangler(root)(["whoami", "--json"]);
  if (!who.ok) return "not logged in (the Cloudflare deletes will fail)";
  try {
    const { accounts = [] } = JSON.parse(who.stdout) as { accounts?: Array<{ name: string }> };
    return accounts.map((a) => a.name).join(", ") || "unknown";
  } catch {
    return "unknown";
  }
};

/** Asks for the project's name; nothing is deleted on any other answer. */
const confirm = async (name: string) => {
  if (!process.stdin.isTTY) throw new Error("Not a terminal: pass --yes to delete without asking.");
  const ask = createInterface({ input: process.stdin, output: process.stdout });
  const typed = await ask.question(`\nType the project's name (${name}) to go ahead: `);
  ask.close();
  if (typed.trim() !== name) throw new Error("Names differ. Nothing was deleted.");
};

/** Runs each delete and says how it went; true when every one is gone. */
const runSteps = (root: string, steps: ReadonlyArray<Step>): boolean => {
  const tools = { wrangler: projectWrangler(root), gh: capture("gh", root) };
  return steps
    .map((step) => {
      const result = tools[step.tool](step.args);
      const said = (result.stderr + result.stdout).trim();
      if (result.ok) console.log(`✓ ${step.label}: deleted`);
      else if (isGone(said)) console.log(`– ${step.label}: not there`);
      else console.log(`✗ ${step.label}: ${lastWords(said)}`);
      return result.ok || isGone(said);
    })
    .every(Boolean);
};

const main = async () => {
  const argv = process.argv.slice(2).filter((arg, i) => i > 0 || arg !== "--");
  const dirArg = argv.find((arg) => !arg.startsWith("-"));
  const root = resolve(
    process.env.INIT_CWD ?? process.cwd(),
    dirArg ?? join(repo, "../cf-saas-try"),
  );
  if (!existsSync(join(root, "cf-saas.json")))
    throw new Error(`${root} is not a project made by the CLI (no cf-saas.json).`);
  // The template and the docs site have cf-saas.json too, and the docs site is live.
  const inRepo = relative(realpathSync(repo), realpathSync(root));
  if (!inRepo.startsWith("..") && !isAbsolute(inRepo))
    throw new Error(`${root} is part of this repository, not a project to tear down.`);
  const keep = argv.includes("--keep");
  const steps = teardownPlan(root, ownRepository(root, capture("git", root)));

  // A delete that finds nothing counts as done, so the wrong account would look like a clean run.
  console.log(`Cloudflare account: ${cloudflareAccounts(root)}`);
  console.log(`This deletes, for good:\n${steps.map((s) => `  ${s.label}`).join("\n")}`);
  console.log(keep ? `  (the folder ${root} stays)` : `  the folder ${root}`);
  if (!argv.includes("--yes")) await confirm(readProject(root).name);

  if (!runSteps(root, steps)) {
    // wrangler.jsonc holds the ids a second run needs, so a failed run keeps the folder.
    console.log("\nSomething was not deleted. The folder stays; fix the cause and run this again.");
    console.log("For the repository, GitHub may need: gh auth refresh -s delete_repo");
    process.exitCode = 1;
    return;
  }
  if (!keep) {
    rmSync(root, { recursive: true, force: true });
    console.log(`✓ ${root}: deleted`);
  }
};

if (import.meta.main)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
