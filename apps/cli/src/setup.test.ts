import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prune } from "@tanstack-cf-saas/blocks";
import { parse } from "jsonc-parser";
import {
  isLoggedIn,
  isReady,
  provision,
  readiness,
  SetupError,
  setupEnvs,
  type Wrangler,
} from "./setup.ts";

const TEMPLATE = join(import.meta.dirname, "../../../templates/saas-starter");

const project = (features: Array<string>) => {
  const dir = mkdtempSync(join(tmpdir(), "setup-"));
  rmSync(dir, { recursive: true });
  cpSync(TEMPLATE, dir, {
    recursive: true,
    filter: (src) => !/node_modules|\.wrangler|\/dist|\.dev\.vars$/.test(src),
  });
  prune(dir, features);
  return dir;
};

/** A wrangler stand-in that records every call, including what went to stdin. */
const fakeWrangler = (existing: { d1?: boolean; secrets?: Array<string> } = {}) => {
  const calls: Array<{ args: ReadonlyArray<string>; input?: string }> = [];
  const wrangler: Wrangler = (args, input) => {
    calls.push({ args, input });
    const [a, b] = args;
    if (a === "d1" && b === "create") {
      return existing.d1
        ? { ok: false, stdout: "", stderr: "A database with that name already exists [code: 7502]" }
        : {
            ok: true,
            stdout: `"database_id": "${"1".repeat(8)}-2222-3333-4444-${"5".repeat(12)}"`,
            stderr: "",
          };
    }
    if (a === "d1" && b === "info")
      return {
        ok: true,
        stdout: JSON.stringify({ uuid: "existing-uuid-0000-0000-0000-000000000000" }),
        stderr: "",
      };
    if (a === "kv") return { ok: true, stdout: `"id": "${"a".repeat(32)}"`, stderr: "" };
    if (a === "secret" && b === "list")
      return {
        ok: true,
        stdout: JSON.stringify((existing.secrets ?? []).map((name) => ({ name }))),
        stderr: "",
      };
    return { ok: true, stdout: "", stderr: "" };
  };
  return { wrangler, calls };
};

describe("readiness", () => {
  test("lists what a fresh project is missing, by name only", () => {
    const dir = project(["auth", "kv"]);
    const items = readiness(dir);
    expect(isReady(items)).toBe(false);
    expect(items.filter((i) => i.state === "missing").map((i) => `${i.name}@${i.env}`)).toContain(
      "DB (D1)@production",
    );
    expect(items.find((i) => i.name === "BETTER_AUTH_SECRET")?.state).toBe("unknown");
  });

  test("reads which secrets are set when wrangler is logged in", () => {
    const dir = project(["auth"]);
    const items = readiness(dir, fakeWrangler({ secrets: ["BETTER_AUTH_SECRET"] }).wrangler);
    expect(
      items.find((i) => i.name === "BETTER_AUTH_SECRET" && i.env === "production")?.state,
    ).toBe("set");
  });
});

describe("provision", () => {
  test("creates resources for both environments, records ids, and sends secrets on stdin", async () => {
    const dir = project(["auth", "kv", "uploads"]);
    const { wrangler, calls } = fakeWrangler();
    await provision(dir, wrangler, {
      envs: ["production", "staging"],
      vars: { APP_URL: "https://acme.dev" },
      secretValue: async () => undefined,
      log: () => undefined,
    });
    const json = parse(readFileSync(join(dir, "wrangler.jsonc"), "utf8"));
    expect(json.d1_databases[0].database_id).toBe("11111111-2222-3333-4444-555555555555");
    expect(json.env.staging.kv_namespaces[0].id).toBe("a".repeat(32));
    expect(json.vars.APP_URL).toBe("https://acme.dev");
    const put = calls.filter((c) => c.args[0] === "secret" && c.args[1] === "put");
    expect(put.map((c) => c.args.join(" "))).toEqual([
      "secret put BETTER_AUTH_SECRET",
      "secret put BETTER_AUTH_SECRET --env staging",
    ]);
    for (const c of put) {
      expect(c.input?.length).toBeGreaterThanOrEqual(32);
      expect(c.args.join(" ")).not.toContain(c.input ?? "");
    }
  });

  test("finds an existing database instead of failing, and a second run creates nothing", async () => {
    const dir = project(["db"]);
    const first = fakeWrangler({ d1: true });
    const options = {
      envs: ["production"] as const,
      vars: {},
      secretValue: async () => undefined,
      log: () => undefined,
    };
    await provision(dir, first.wrangler, options);
    expect(
      parse(readFileSync(join(dir, "wrangler.jsonc"), "utf8")).d1_databases[0].database_id,
    ).toBe("existing-uuid-0000-0000-0000-000000000000");
    const second = fakeWrangler();
    await provision(dir, second.wrangler, options);
    expect(second.calls.filter((c) => c.args[1] === "create")).toEqual([]);
  });
});

describe("provision on a second run", () => {
  const options = {
    envs: ["production", "staging"] as const,
    vars: {},
    secretValue: async () => undefined,
    log: () => undefined,
  };

  test("puts no secrets that are already set: BETTER_AUTH_SECRET is never regenerated", async () => {
    const dir = project(["auth"]);
    const { wrangler, calls } = fakeWrangler({ secrets: ["BETTER_AUTH_SECRET"] });
    await provision(dir, wrangler, options);
    expect(calls.filter((c) => c.args[0] === "secret" && c.args[1] === "put")).toEqual([]);
  });

  test("still replaces a set secret when a value is given on purpose", async () => {
    const dir = project(["auth"]);
    const { wrangler, calls } = fakeWrangler({ secrets: ["BETTER_AUTH_SECRET"] });
    await provision(dir, wrangler, {
      ...options,
      envs: ["staging"],
      secretValue: async (key) => (key === "BETTER_AUTH_SECRET" ? "chosen" : undefined),
    });
    const put = calls.filter((c) => c.args[1] === "put");
    expect(put.map((c) => `${c.args.join(" ")} <${c.input}>`)).toEqual([
      "secret put BETTER_AUTH_SECRET --env staging <chosen>",
    ]);
  });
});

describe("environments", () => {
  test("refuses an environment that is not production or staging", async () => {
    expect(() => setupEnvs("Staging", [])).toThrow(
      '--env must be production or staging, not "Staging".',
    );
    const { wrangler, calls } = fakeWrangler();
    await expect(
      provision(project(["auth"]), wrangler, {
        envs: ["Staging" as "staging"],
        vars: {},
        secretValue: async () => undefined,
        log: () => undefined,
      }),
    ).rejects.toThrow(SetupError);
    expect(calls).toEqual([]);
  });

  test("needs --env for a --var or a secret from the environment", () => {
    expect(() => setupEnvs(undefined, ["--var APP_URL"])).toThrow(
      /--var APP_URL would be set in both production and staging/,
    );
    expect(() => setupEnvs(undefined, ["STRIPE_SECRET_KEY"])).toThrow(/--env production/);
    expect(setupEnvs("staging", ["--var APP_URL"])).toEqual(["staging"]);
    expect(setupEnvs(undefined, [])).toEqual(["production", "staging"]);
  });
});

test("checks login with whoami --json, since plain whoami exits 0 when logged out", () => {
  const seen: Array<string> = [];
  const loggedOut: Wrangler = (args) => {
    seen.push(args.join(" "));
    return { ok: !args.includes("--json"), stdout: "", stderr: "" };
  };
  expect(isLoggedIn(loggedOut)).toBe(false);
  expect(seen).toEqual(["whoami --json"]);
});
