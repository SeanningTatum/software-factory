import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prune } from "@tanstack-cf-saas/blocks";
import { parse } from "jsonc-parser";
import {
  accountId,
  appUrl,
  firstDeploy,
  isLoggedIn,
  isReady,
  migrate,
  provision,
  putSecret,
  readiness,
  SetupError,
  setupEnvs,
  typedSettings,
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
    // Each environment's database is migrated once its id is on disk, before its secrets.
    const steps = calls.map((c) => c.args.join(" "));
    const migrated = steps.filter((s) => s.startsWith("d1 migrations"));
    expect(migrated).toEqual([
      "d1 migrations apply DB --remote",
      "d1 migrations apply DB --remote --env staging",
    ]);
    const created = steps.indexOf("d1 create saas-starter-db");
    expect(created).toBeGreaterThanOrEqual(0);
    expect(created).toBeLessThan(steps.indexOf(migrated[0] ?? ""));
    expect(steps.indexOf(migrated[0] ?? "")).toBeLessThan(
      steps.indexOf("secret put BETTER_AUTH_SECRET"),
    );
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

describe("putSecret", () => {
  test("sends the value on stdin, never in the arguments, and names the environment", () => {
    const { wrangler, calls } = fakeWrangler();
    putSecret(wrangler, "STRIPE_SECRET_KEY", "staging", "sk_test_1");
    putSecret(wrangler, "STRIPE_SECRET_KEY", "production", "sk_live_1");
    expect(calls).toEqual([
      { args: ["secret", "put", "STRIPE_SECRET_KEY", "--env", "staging"], input: "sk_test_1" },
      { args: ["secret", "put", "STRIPE_SECRET_KEY"], input: "sk_live_1" },
    ]);
  });

  test("fails with wrangler's error", () => {
    const failing: Wrangler = () => ({ ok: false, stdout: "", stderr: "not authorized" });
    expect(() => putSecret(failing, "K", "staging", "v")).toThrow(/K \(staging\).*not authorized/s);
  });
});

describe("what GitHub Actions needs from Cloudflare's side", () => {
  test("an environment's URL is its APP_URL, once that is not local", async () => {
    const dir = project([]);
    expect(appUrl(dir, "staging")).toBeUndefined();
    await provision(dir, fakeWrangler().wrangler, {
      envs: ["staging"],
      vars: { APP_URL: "https://staging.example.com/" },
      secretValue: async () => undefined,
      log: () => {},
    });
    expect(appUrl(dir, "staging")).toBe("https://staging.example.com");
    expect(appUrl(dir, "production")).toBeUndefined();
  });

  test("the account is wrangler's, only when there is exactly one", () => {
    const who =
      (accounts: Array<{ id: string }>): Wrangler =>
      () => ({
        ok: true,
        stdout: JSON.stringify({ loggedIn: true, accounts }),
        stderr: "",
      });
    expect(accountId(who([{ id: "one" }]))).toBe("one");
    expect(accountId(who([{ id: "one" }, { id: "two" }]))).toBeUndefined();
    expect(accountId(() => ({ ok: false, stdout: "", stderr: "" }))).toBeUndefined();
    expect(accountId(() => ({ ok: true, stdout: "not json", stderr: "" }))).toBeUndefined();
  });
});

describe("settings typed during create", () => {
  const blanks = [
    { key: "STRIPE_SECRET_KEY", secret: true },
    { key: "STRIPE_PRICE_PRO", secret: false },
    { key: "LEFT_EMPTY", secret: true },
  ];
  const typed = { STRIPE_SECRET_KEY: "typed-test-key", STRIPE_PRICE_PRO: "price_123" };

  test("go to staging, split into secrets and vars", () => {
    expect(typedSettings(blanks, typed, "staging")).toEqual({
      secrets: { STRIPE_SECRET_KEY: "typed-test-key" },
      vars: { STRIPE_PRICE_PRO: "price_123" },
    });
  });

  test("never go to production: they are test data", () => {
    expect(typedSettings(blanks, typed, "production")).toEqual({ secrets: {}, vars: {} });
  });
});

describe("migrate", () => {
  test("applies to the local database, and stops with wrangler's words when it fails", () => {
    const dir = project(["auth"]);
    const { wrangler, calls } = fakeWrangler();
    migrate(dir, wrangler, "local", () => {});
    expect(calls.map((c) => c.args.join(" "))).toEqual(["d1 migrations apply DB --local"]);
    const broken: Wrangler = () => ({ ok: false, stdout: "", stderr: "no such table" });
    expect(() => migrate(dir, broken, "staging", () => {})).toThrow(/staging.*\n.*no such table/);
  });

  test("does nothing in a project with no database", () => {
    const { wrangler, calls } = fakeWrangler();
    migrate(project([]), wrangler, "local", () => {});
    expect(calls).toEqual([]);
  });

  test("does nothing before the first migration is generated", () => {
    const dir = project(["auth"]);
    rmSync(join(dir, "drizzle"), { recursive: true });
    const { wrangler, calls } = fakeWrangler();
    migrate(dir, wrangler, "staging", () => {});
    expect(calls).toEqual([]);
  });
});

describe("firstDeploy", () => {
  /** A deploy stand-in: prints what wrangler prints, on an account whose subdomain is `acme`. */
  const deployer = (printsAddress = true) => {
    const ran: Array<string> = [];
    const script = (name: string) => {
      ran.push(name);
      const worker = name === "deploy" ? "saas-starter" : "saas-starter-staging";
      const stdout = printsAddress
        ? `Uploaded ${worker}\n  https://${worker}.acme.workers.dev\n`
        : "";
      return { ok: true, stdout, stderr: "" };
    };
    return { ran, script };
  };

  test("learns the address from staging, then deploys each environment under its own URL", () => {
    const dir = project([]);
    const { ran, script } = deployer();
    firstDeploy(dir, ["production", "staging"], script, () => {});
    // Staging twice: its first deploy could not know its URL. Production once: the subdomain was known.
    expect(ran).toEqual(["deploy:staging", "deploy:staging", "deploy"]);
    expect(appUrl(dir, "staging")).toBe("https://saas-starter-staging.acme.workers.dev");
    expect(appUrl(dir, "production")).toBe("https://saas-starter.acme.workers.dev");

    ran.length = 0;
    firstDeploy(dir, ["production", "staging"], script, () => {});
    expect(ran).toEqual([]);
  });

  test("a deploy that fails under the new URL leaves no URL, so the next run tries again", () => {
    const dir = project([]);
    const { ran, script } = deployer();
    const failsSecond = (name: string) =>
      ran.length === 1 ? { ok: false, stdout: "network down", stderr: "" } : script(name);
    expect(() => firstDeploy(dir, ["staging"], failsSecond, () => {})).toThrow(/network down/);
    expect(appUrl(dir, "staging")).toBeUndefined();

    firstDeploy(dir, ["staging"], script, () => {});
    expect(appUrl(dir, "staging")).toBe("https://saas-starter-staging.acme.workers.dev");
  });

  test("an environment with its own domain deploys once under it; a later URL is only recorded", () => {
    const dir = project([]);
    const { ran, script } = deployer();
    const urls = { production: "https://app.example.com" };
    firstDeploy(dir, ["production"], script, () => {}, urls);
    expect(ran).toEqual(["deploy"]);
    expect(appUrl(dir, "production")).toBe("https://app.example.com");

    firstDeploy(dir, ["production"], script, () => {}, { production: "https://new.example.com" });
    expect(ran).toEqual(["deploy"]);
    expect(appUrl(dir, "production")).toBe("https://new.example.com");
  });

  test("touches only the environments asked for", () => {
    const dir = project([]);
    const { ran, script } = deployer();
    firstDeploy(dir, ["staging"], script, () => {});
    expect(ran).toEqual(["deploy:staging", "deploy:staging"]);
    expect(appUrl(dir, "production")).toBeUndefined();
  });

  test("stops with the build's last lines when a deploy fails, and when no address is printed", () => {
    const dir = project([]);
    const broken = () => ({ ok: false, stdout: "vite: build failed", stderr: "" });
    expect(() => firstDeploy(dir, ["staging"], broken, () => {})).toThrow(
      /staging failed[\s\S]*build failed/,
    );
    expect(() => firstDeploy(dir, ["staging"], deployer(false).script, () => {})).toThrow(
      /no workers\.dev address/,
    );
    expect(appUrl(dir, "staging")).toBeUndefined();
  });
});
