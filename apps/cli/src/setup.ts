import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Binding,
  type BlockManifest,
  type EnvName,
  envNames,
  formattingOf,
  loadManifests,
  PLACEHOLDER_D1_ID,
  PLACEHOLDER_KV_ID,
  readBinding,
  readProject,
  resourceName,
  setBindingField,
  WRANGLER_FILE,
} from "@tanstack-cf-saas/blocks";
import { applyEdits, modify, parse } from "jsonc-parser";

/** Runs wrangler. `input` goes to stdin, which is how secrets travel: never as arguments. */
export type Wrangler = (
  args: ReadonlyArray<string>,
  input?: string,
) => { ok: boolean; stdout: string; stderr: string };

export type ItemState = "set" | "missing" | "unknown" | "manual";

export interface Item {
  readonly name: string;
  readonly env: EnvName | "all";
  readonly required: boolean;
  readonly state: ItemState;
  readonly fix: string;
  /** Set on secrets: the ones `setup` asks for and uploads when run again. */
  readonly secret?: true;
}

const SETUP = "bun run setup";
export const SECRET_BYTES = 36;
export const GENERATED_SECRETS = new Set(["BETTER_AUTH_SECRET"]);

/** Wrangler's flag for an environment: production is the top level, so it has none. */
const envFlag = (env: EnvName) => (env === "production" ? [] : ["--env", env]);

const badEnv = (env: string) => `--env must be ${envNames.join(" or ")}, not "${env}".`;

const listSecrets = (wrangler: Wrangler, env: EnvName) =>
  wrangler(["secret", "list", "--format", "json", ...envFlag(env)]);
const namesIn = (stdout: string): ReadonlySet<string> =>
  new Set((JSON.parse(stdout) as Array<{ name: string }>).map((s) => s.name));

/** Names of the secrets set in `env`; undefined when wrangler can't list them. */
const secretNames = (wrangler: Wrangler, env: EnvName): ReadonlySet<string> | undefined => {
  const listed = listSecrets(wrangler, env);
  return listed.ok ? namesIn(listed.stdout) : undefined;
};

/** What wrangler says when the Worker isn't deployed yet: newer versions in words, older by code. */
const NO_WORKER = /Worker "[^"]+"(?: \(env: [^)]+\))? not found|\[code: 100(?:07|90)\]/;

/**
 * Names of the secrets set in `env`, for deciding what to put. Only a Worker that doesn't exist yet
 * has none; any other failure throws, because taking a set BETTER_AUTH_SECRET for missing would
 * replace it and sign every user out.
 */
const secretsToKeep = (wrangler: Wrangler, env: EnvName): ReadonlySet<string> => {
  const listed = listSecrets(wrangler, env);
  if (listed.ok) return namesIn(listed.stdout);
  if (NO_WORKER.test(listed.stdout + listed.stderr)) return new Set();
  throw new SetupError(
    `Listing the secrets of ${env} failed, so setup can't tell which are set. No secret of ${env} was uploaded; run it again:\n${(listed.stderr || listed.stdout).trim()}`,
  );
};

const wranglerText = (root: string) => readFileSync(join(root, WRANGLER_FILE), "utf8");
const enabled = (root: string) => [...loadManifests(root).values()];

const varsFor = (text: string, env: EnvName): Record<string, unknown> => {
  const json = parse(text) as {
    vars?: Record<string, unknown>;
    env?: Record<string, { vars?: Record<string, unknown> }>;
  };
  return (env === "production" ? json.vars : json.env?.[env]?.vars) ?? {};
};

const isBlank = (value: unknown) => typeof value !== "string" || value.trim() === "";

/** A required var that still holds its local default is not ready for a deploy. */
const isLocalOnly = (key: string, value: unknown) =>
  key === "APP_URL" && String(value).startsWith("http://localhost");

/** Whether a D1 or KV binding has a real id yet; other bindings need no id. */
const resourceItem = (b: Binding, text: string, env: EnvName): Item | undefined => {
  if (b.type !== "d1" && b.type !== "kv") return undefined;
  const id =
    b.type === "d1"
      ? readBinding(text, env, "d1_databases", b.binding)?.database_id
      : readBinding(text, env, "kv_namespaces", b.binding)?.id;
  const placeholder = b.type === "d1" ? PLACEHOLDER_D1_ID : PLACEHOLDER_KV_ID;
  return {
    name: `${b.binding} (${b.type === "d1" ? "D1" : "KV"})`,
    env,
    required: true,
    state: id && id !== placeholder ? "set" : "missing",
    fix: SETUP,
  };
};

const resourceItems = (manifests: ReadonlyArray<BlockManifest>, text: string): Array<Item> =>
  envNames.flatMap((env) =>
    manifests.flatMap((m) =>
      (m.bindings ?? []).flatMap((b) => {
        const item = resourceItem(b, text, env);
        return item ? [item] : [];
      }),
    ),
  );

const varItems = (manifests: ReadonlyArray<BlockManifest>, text: string): Array<Item> =>
  envNames.flatMap((env) => {
    const vars = varsFor(text, env);
    return manifests.flatMap((m) =>
      Object.entries(m.vars ?? {}).map(([key, spec]) => ({
        name: key,
        env,
        required: spec.required,
        state:
          isBlank(vars[key]) || isLocalOnly(key, vars[key])
            ? ("missing" as const)
            : ("set" as const),
        fix: `${SETUP} --env ${env} --var ${key}=...`,
      })),
    );
  });

const secretItems = (
  manifests: ReadonlyArray<BlockManifest>,
  wrangler: Wrangler | undefined,
): Array<Item> =>
  envNames.flatMap((env) => {
    const names = wrangler && secretNames(wrangler, env);
    return manifests.flatMap((m) =>
      Object.entries(m.secrets ?? {}).map(([key, spec]) => ({
        name: key,
        env,
        required: spec.required,
        state: names
          ? names.has(key)
            ? ("set" as const)
            : ("missing" as const)
          : ("unknown" as const),
        fix: `${SETUP} --env ${env}`,
        secret: true as const,
      })),
    );
  });

const manualItems = (manifests: ReadonlyArray<BlockManifest>): Array<Item> =>
  manifests.flatMap((m) =>
    (m.setup ?? []).map((step) => ({
      name: step.description,
      env: "all" as const,
      required: false,
      state: "manual" as const,
      fix: step.help ?? "see the feature's TIMELINE.md",
    })),
  );

/**
 * What a production deploy still needs, by name only: values are never read or printed.
 * Without a logged-in wrangler, secrets show as unknown.
 */
export const readiness = (root: string, wrangler?: Wrangler): ReadonlyArray<Item> => {
  const manifests = enabled(root);
  const text = wranglerText(root);
  return [
    ...resourceItems(manifests, text),
    ...varItems(manifests, text),
    ...secretItems(manifests, wrangler),
    ...manualItems(manifests),
  ];
};

export const isReady = (items: ReadonlyArray<Item>) =>
  !items.some((i) => i.required && i.state === "missing");

/** The secrets Cloudflare lacks in some environment, required or not, each named once. */
export const missingSecrets = (items: ReadonlyArray<Item>): ReadonlyArray<string> => [
  ...new Set(items.filter((i) => i.secret && i.state === "missing").map((i) => i.name)),
];

const D1_ID = /"?database_id"?\s*[:=]\s*"([0-9a-f-]{36})"/;
const KV_ID = /"?id"?\s*[:=]\s*"([0-9a-f]{32})"/;
const EXISTS = /already exists|already taken|code: 10014|code: 10026/i;

export class SetupError extends Error {}

const createD1 = (wrangler: Wrangler, name: string): string => {
  const created = wrangler(["d1", "create", name]);
  const id = D1_ID.exec(created.stdout)?.[1];
  if (id) return id;
  if (!EXISTS.test(created.stdout + created.stderr))
    throw new SetupError(`wrangler d1 create ${name} failed:\n${created.stderr}`);
  const info = wrangler(["d1", "info", name, "--json"]);
  const uuid = info.ok ? (JSON.parse(info.stdout) as { uuid?: string }).uuid : undefined;
  if (!uuid) throw new SetupError(`Could not read the id of existing D1 database ${name}`);
  return uuid;
};

const createKv = (wrangler: Wrangler, name: string): string => {
  const created = wrangler(["kv", "namespace", "create", name]);
  const id = KV_ID.exec(created.stdout)?.[1];
  if (id) return id;
  const list = wrangler(["kv", "namespace", "list"]);
  const found = list.ok
    ? (JSON.parse(list.stdout) as Array<{ id: string; title: string }>).find(
        (n) => n.title === name,
      )
    : undefined;
  if (!found)
    throw new SetupError(`wrangler kv namespace create ${name} failed:\n${created.stderr}`);
  return found.id;
};

const createR2 = (wrangler: Wrangler, name: string) => {
  const created = wrangler(["r2", "bucket", "create", name]);
  if (!created.ok && !EXISTS.test(created.stdout + created.stderr)) {
    throw new SetupError(`wrangler r2 bucket create ${name} failed:\n${created.stderr}`);
  }
};

export interface ProvisionOptions {
  readonly envs: ReadonlyArray<EnvName>;
  /** Var values to write into wrangler.jsonc, from `--var KEY=value`. */
  readonly vars: Readonly<Record<string, string>>;
  /**
   * Where secret values come from: the process environment, or a prompt. Undefined skips the
   * secret; `isSet` says wrangler already has it.
   */
  readonly secretValue: (key: string, env: EnvName, isSet: boolean) => Promise<string | undefined>;
  readonly log: (line: string) => void;
}

/** Creates one binding's resource when it is missing, and returns wrangler.jsonc with its id. */
const provisionBinding = (
  text: string,
  binding: Binding,
  env: EnvName,
  project: string,
  wrangler: Wrangler,
  log: (line: string) => void,
): string => {
  if (
    binding.type === "d1" &&
    readBinding(text, env, "d1_databases", binding.binding)?.database_id === PLACEHOLDER_D1_ID
  ) {
    const name = resourceName(binding.database, project, env);
    const id = createD1(wrangler, name);
    log(`D1 ${name} (${env}): ${id}`);
    return setBindingField(text, env, "d1_databases", binding.binding, "database_id", id);
  }
  if (
    binding.type === "kv" &&
    readBinding(text, env, "kv_namespaces", binding.binding)?.id === PLACEHOLDER_KV_ID
  ) {
    const name = resourceName(binding.namespace, project, env);
    const id = createKv(wrangler, name);
    log(`KV ${name} (${env}): ${id}`);
    return setBindingField(text, env, "kv_namespaces", binding.binding, "id", id);
  }
  if (binding.type === "r2") {
    const name = resourceName(binding.bucket, project, env);
    createR2(wrangler, name);
    log(`R2 ${name} (${env}): ready`);
  }
  return text;
};

export const withVars = (text: string, env: EnvName, vars: Readonly<Record<string, string>>) =>
  Object.entries(vars).reduce((acc, [key, value]) => {
    const path = env === "production" ? ["vars", key] : ["env", env, "vars", key];
    return applyEdits(acc, modify(acc, path, value, { formattingOptions: formattingOf(acc) }));
  }, text);

/** Sets one secret in `env`. The value goes to wrangler on stdin, never as an argument. */
export const putSecret = (wrangler: Wrangler, key: string, env: EnvName, value: string) => {
  const put = wrangler(["secret", "put", key, ...envFlag(env)], value);
  if (!put.ok) throw new SetupError(`Setting ${key} (${env}) failed:\n${put.stderr}`);
};

const putSecrets = async (
  manifests: ReadonlyArray<BlockManifest>,
  env: EnvName,
  wrangler: Wrangler,
  options: ProvisionOptions,
) => {
  const existing = secretsToKeep(wrangler, env);
  for (const [key] of manifests.flatMap((m) => Object.entries(m.secrets ?? {}))) {
    const isSet = existing.has(key);
    // A secret already set is only replaced by a value given on purpose; never regenerated.
    const value =
      (await options.secretValue(key, env, isSet)) ??
      (GENERATED_SECRETS.has(key) && !isSet
        ? randomBytes(SECRET_BYTES).toString("base64url")
        : undefined);
    if (!value) {
      if (isSet) options.log(`secret ${key} (${env}): already set`);
      continue;
    }
    putSecret(wrangler, key, env, value);
    options.log(`secret ${key} (${env}): set`);
  }
};

/**
 * Applies the migrations in `drizzle/` to each D1 database, on this machine or in `where`. Safe to
 * run again: wrangler applies only what a database has not seen. Without a terminal it asks
 * nothing, and every caller here runs it without one.
 */
export const migrate = (
  root: string,
  wrangler: Wrangler,
  where: EnvName | "local",
  log: (line: string) => void,
) => {
  const target = where === "local" ? ["--local"] : ["--remote", ...envFlag(where)];
  // A project that has not run db:generate yet has nothing to apply, and wrangler would refuse.
  const dir = join(root, "drizzle");
  if (!existsSync(dir) || !readdirSync(dir).some((file) => file.endsWith(".sql"))) return;
  for (const b of enabled(root).flatMap((m) => m.bindings ?? [])) {
    if (b.type !== "d1") continue;
    const applied = wrangler(["d1", "migrations", "apply", b.binding, ...target]);
    if (!applied.ok)
      throw new SetupError(
        `Applying migrations to ${b.binding} (${where}) failed:\n${(applied.stderr || applied.stdout).trim()}`,
      );
    log(`migrations ${b.binding} (${where}): applied`);
  }
};

/**
 * Creates what is missing, records ids in wrangler.jsonc and applies the migrations. Safe to run
 * again: existing resources are found, not duplicated, and vars or ids already set are left alone
 * unless passed explicitly.
 */
export const provision = async (root: string, wrangler: Wrangler, options: ProvisionOptions) => {
  for (const env of options.envs) {
    if (!envNames.includes(env)) throw new SetupError(badEnv(env));
  }
  const project = readProject(root).name;
  const manifests = enabled(root);
  let text = wranglerText(root);

  for (const env of options.envs) {
    for (const binding of manifests.flatMap((m) => m.bindings ?? [])) {
      text = provisionBinding(text, binding, env, project, wrangler, options.log);
    }
    text = withVars(text, env, options.vars);
    writeFileSync(join(root, WRANGLER_FILE), text);
    // After the write: wrangler finds the database through the id in wrangler.jsonc.
    migrate(root, wrangler, env, options.log);
    await putSecrets(manifests, env, wrangler, options);
  }
};

/** Records `url` as the environment's APP_URL and deploys; a failed deploy takes the URL back. */
const deployUnder = (file: string, env: EnvName, url: string, deploy: () => void) => {
  const before = readFileSync(file, "utf8");
  writeFileSync(file, withVars(before, env, { APP_URL: url }));
  try {
    deploy();
  } catch (error) {
    // Without its URL the environment counts as not deployed, so the next run tries again.
    writeFileSync(file, before);
    throw error;
  }
};

/** appUrl drops the slash too, and the smoke test appends /api/health. */
const withoutSlash = (url: string | undefined) => url?.replace(/\/+$/, "");

/** Records a live environment's new URL, and deploys under it when `redeploy` allows. */
const moveLive = (
  root: string,
  env: EnvName,
  url: string,
  redeploy: boolean,
  deploy: () => void,
  log: (line: string) => void,
) => {
  const file = join(root, WRANGLER_FILE);
  if (!redeploy) {
    writeFileSync(file, withVars(wranglerText(root), env, { APP_URL: url }));
    log(`${env}: URL is now ${url}; its next deploy from CI carries it`);
    return;
  }
  deployUnder(file, env, url, deploy);
  log(`${env}: live at ${url}`);
};

/** Runs one of the project's package scripts and captures what it printed. */
export type RunScript = (script: string) => { ok: boolean; stdout: string; stderr: string };

const WORKERS_DEV = /https:\/\/[a-z0-9-]+\.([a-z0-9-]+)\.workers\.dev/i;

/**
 * Deploys each of `envs` that has no URL yet, so its Worker exists with its bindings, and records
 * where it lives as APP_URL. `urls` holds an address the user gave, for an environment with its own
 * domain. Without one the address is on workers.dev, and nothing but a deploy says what an
 * account's subdomain there is: the first deploy runs before its URL is known, wrangler prints the
 * address, the URL is written, and that environment deploys once more under it. The subdomain then
 * gives every other environment's address up front.
 *
 * An environment that has a URL and is given a new one, such as the domain it moves to off
 * workers.dev, deploys again only when `redeploy` says the checkout is what CI would ship. Else the
 * URL is only recorded and the next deploy carries it. Returns each URL it recorded, by environment.
 */
export const firstDeploy = (
  root: string,
  envs: ReadonlyArray<EnvName>,
  script: RunScript,
  log: (line: string) => void,
  urls: Readonly<Partial<Record<EnvName, string>>> = {},
  redeploy = false,
) => {
  const file = join(root, WRANGLER_FILE);
  const worker = (parse(wranglerText(root)) as { name: string }).name;
  const deploy = (env: EnvName) => {
    log(`${env}: building and deploying`);
    const ran = script(env === "production" ? "deploy" : `deploy:${env}`);
    const said = ran.stdout + ran.stderr;
    if (!ran.ok)
      throw new SetupError(
        `Deploying ${env} failed:\n${said.trim().split("\n").slice(-12).join("\n")}`,
      );
    return WORKERS_DEV.exec(said)?.[1];
  };
  let subdomain: string | undefined;
  const recordedNow: Partial<Record<EnvName, string>> = {};
  // Staging first: if a first deploy goes wrong, it goes wrong there.
  for (const env of (["staging", "production"] as const).filter((e) => envs.includes(e))) {
    const recorded = appUrl(root, env);
    const given = withoutSlash(urls[env]);
    if (recorded) {
      if (given && given !== recorded) {
        moveLive(root, env, given, redeploy, () => deploy(env), log);
        recordedNow[env] = given;
      }
      continue;
    }
    if (!given) subdomain ??= deploy(env);
    if (!given && !subdomain)
      throw new SetupError(
        `${env} is deployed, but wrangler printed no workers.dev address. Give its URL: ${SETUP} --env ${env} --var APP_URL=https://...`,
      );
    const url =
      given ??
      `https://${env === "production" ? worker : `${worker}-${env}`}.${subdomain}.workers.dev`;
    deployUnder(file, env, url, () => deploy(env));
    log(`${env}: live at ${url}`);
    recordedNow[env] = url;
  }
  return recordedNow;
};

/** Whether `url` is a workers.dev address, where a gradual rollout cannot pin visitors. */
export const onWorkersDev = (url: string) => /\.workers\.dev\/?$/i.test(url);

/** Whether setup asks for `env`'s URL: it has none yet, or is still on workers.dev. */
export const needsUrl = (root: string, env: EnvName) => {
  const url = appUrl(root, env);
  return !url || onWorkersDev(url);
};

/**
 * The step the closing note lists while production is on workers.dev: what a domain unlocks and
 * `move`, the command that moves it there. Undefined once production has a domain, or no URL.
 */
export const domainStep = (root: string, move: string): string | undefined => {
  const url = appUrl(root, "production");
  if (!url || !onWorkersDev(url)) return undefined;
  return [
    `Production is on ${url}. A domain of your own unlocks gradual rollouts and a stable link on GitHub.`,
    `Once it is on Cloudflare: ${move}`,
    "Add the Transform Rule in docs/branches.md with it (Move to your own domain).",
  ].join("\n");
};

/**
 * The environments setup acts on: the one `--env` names, else both. Values meant for one
 * environment (a `--var`, or a secret read from the process environment) need `--env`, so a
 * production key never lands in staging by accident.
 */
export const setupEnvs = (
  env: string | undefined,
  shared: ReadonlyArray<string>,
): ReadonlyArray<EnvName> => {
  if (env !== undefined) {
    if (!envNames.includes(env as EnvName)) throw new SetupError(badEnv(env));
    return [env as EnvName];
  }
  if (shared.length) {
    throw new SetupError(
      `${shared.join(", ")} would be set in both production and staging. Run setup once per environment with --env production or --env staging.`,
    );
  }
  return envNames;
};

/** Where `create` keeps production's PostHog key; POSTHOG_KEY holds staging's, which dev uses. */
export const PRODUCTION_POSTHOG_KEY = "POSTHOG_KEY_PRODUCTION";

/**
 * What the settings typed during `create` give one environment. They were typed for local use, so
 * they are test data: staging gets them, production never does.
 */
export const typedSettings = (
  blanks: ReadonlyArray<{ readonly key: string; readonly secret: boolean }>,
  typed: Readonly<Record<string, string>> | undefined,
  env: EnvName,
) => {
  const pick = (secret: boolean): Record<string, string> =>
    Object.fromEntries(
      blanks.flatMap((b) => {
        const value = env === "staging" && b.secret === secret ? typed?.[b.key] : undefined;
        return value ? [[b.key, value]] : [];
      }),
    );
  const secrets = pick(true);
  const posthog = typed?.[env === "production" ? PRODUCTION_POSTHOG_KEY : "POSTHOG_KEY"];
  if (posthog) secrets.POSTHOG_KEY = posthog;
  return { vars: pick(false), secrets };
};

/** The deployed URL of `env`, once APP_URL holds one; undefined while it is blank or local. */
export const appUrl = (root: string, env: EnvName): string | undefined => {
  const value = varsFor(wranglerText(root), env).APP_URL;
  if (isBlank(value) || isLocalOnly("APP_URL", value)) return undefined;
  // The smoke test appends /api/health, so no trailing slash.
  let url = String(value);
  while (url.endsWith("/")) url = url.slice(0, -1);
  return url;
};

/** The Cloudflare account wrangler is logged in to, when there is exactly one to choose. */
export const accountId = (wrangler: Wrangler): string | undefined => {
  const who = wrangler(["whoami", "--json"]);
  if (!who.ok) return undefined;
  try {
    const { accounts = [] } = JSON.parse(who.stdout) as { accounts?: Array<{ id: string }> };
    return accounts.length === 1 ? accounts[0]?.id : undefined;
  } catch {
    return undefined;
  }
};

/** Whether wrangler is logged in. Plain `whoami` exits 0 even when it is not; `--json` does not. */
export const isLoggedIn = (wrangler: Wrangler) => wrangler(["whoami", "--json"]).ok;
