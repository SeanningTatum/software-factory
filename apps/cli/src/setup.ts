import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Binding,
  type BlockManifest,
  type EnvName,
  envNames,
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
}

const SETUP = "bunx create-tanstack-cf-saas setup";
const SECRET_BYTES = 36;
const GENERATED_SECRETS = new Set(["BETTER_AUTH_SECRET"]);

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
    const listed = wrangler?.([
      "secret",
      "list",
      "--format",
      "json",
      ...(env === "staging" ? ["--env", "staging"] : []),
    ]);
    const names = listed?.ok
      ? new Set((JSON.parse(listed.stdout) as Array<{ name: string }>).map((s) => s.name))
      : undefined;
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
        fix: `${key}=... ${SETUP} --env ${env}`,
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
  /** Where secret values come from: the process environment, or a prompt. Undefined skips the secret. */
  readonly secretValue: (key: string, env: EnvName) => Promise<string | undefined>;
  readonly log: (line: string) => void;
}

/**
 * Creates what is missing and records ids in wrangler.jsonc. Safe to run again: existing resources
 * are found, not duplicated, and vars or ids already set are left alone unless passed explicitly.
 */
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

const withVars = (text: string, env: EnvName, vars: Readonly<Record<string, string>>) =>
  Object.entries(vars).reduce((acc, [key, value]) => {
    const path = env === "production" ? ["vars", key] : ["env", env, "vars", key];
    return applyEdits(
      acc,
      modify(acc, path, value, { formattingOptions: { insertSpaces: false, tabSize: 1 } }),
    );
  }, text);

const putSecrets = async (
  manifests: ReadonlyArray<BlockManifest>,
  env: EnvName,
  wrangler: Wrangler,
  options: ProvisionOptions,
) => {
  for (const [key] of manifests.flatMap((m) => Object.entries(m.secrets ?? {}))) {
    const value =
      (await options.secretValue(key, env)) ??
      (GENERATED_SECRETS.has(key) ? randomBytes(SECRET_BYTES).toString("base64url") : undefined);
    if (!value) continue;
    const put = wrangler(
      ["secret", "put", key, ...(env === "staging" ? ["--env", "staging"] : [])],
      value,
    );
    if (!put.ok) throw new SetupError(`Setting ${key} (${env}) failed:\n${put.stderr}`);
    options.log(`secret ${key} (${env}): set`);
  }
};

/**
 * Creates what is missing and records ids in wrangler.jsonc. Safe to run again: existing resources
 * are found, not duplicated, and vars or ids already set are left alone unless passed explicitly.
 */
export const provision = async (root: string, wrangler: Wrangler, options: ProvisionOptions) => {
  const project = readProject(root).name;
  const manifests = enabled(root);
  let text = wranglerText(root);

  for (const env of options.envs) {
    for (const binding of manifests.flatMap((m) => m.bindings ?? [])) {
      text = provisionBinding(text, binding, env, project, wrangler, options.log);
    }
    text = withVars(text, env, options.vars);
    writeFileSync(join(root, WRANGLER_FILE), text);
    await putSecrets(manifests, env, wrangler, options);
  }
};
