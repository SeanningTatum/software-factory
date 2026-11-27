import { Effect } from "effect";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/app/env.ts";
import type { Db } from "#/features/core/db/api/database.ts";
import { makeTestDb } from "#/features/core/db/api/test-database.ts";
import { authSchema } from "../schema.ts";
import { captchaPlugin, signInCaptcha, turnstileKeys } from "./captcha.ts";
import { env, handled, overAccountLimit, post } from "./test-auth.ts";

const request = (...args: Parameters<typeof handled>) => Effect.runPromise(handled(...args));

const TEST_SECRET = "1x0000000000000000000000000000000AA";
const envWith = (vars: Record<string, string>) => vars as unknown as AppEnv;
const deps = (env: AppEnv, warnings: Array<string> = []) => ({
  env,
  onEvent: () => {},
  onWarning: (message: string) => void warnings.push(message),
  loggedErrors: () => 0,
});

describe("turnstileKeys", () => {
  it("needs both keys", () => {
    expect(turnstileKeys(envWith({}))).toBeUndefined();
    expect(turnstileKeys(envWith({ TURNSTILE_SITE_KEY: "s" }))).toBeUndefined();
    expect(turnstileKeys(envWith({ TURNSTILE_SECRET_KEY: "k" }))).toBeUndefined();
    expect(turnstileKeys(envWith({ TURNSTILE_SITE_KEY: "s", TURNSTILE_SECRET_KEY: "k" }))).toEqual({
      siteKey: "s",
      secretKey: "k",
    });
  });
});

describe("captchaPlugin", () => {
  it("adds nothing without keys", () => {
    expect(captchaPlugin(deps(envWith({ APP_URL: "http://localhost:3000" })))).toEqual([]);
  });

  it("adds the captcha plugin with both keys", () => {
    const plugins = captchaPlugin(
      deps(envWith({ TURNSTILE_SITE_KEY: "s", TURNSTILE_SECRET_KEY: "k" })),
    );
    expect(plugins.map((plugin) => plugin.id)).toEqual(["captcha"]);
  });

  it("warns about the test secret anywhere but localhost", () => {
    const keys = { TURNSTILE_SITE_KEY: "s", TURNSTILE_SECRET_KEY: TEST_SECRET };
    const local: Array<string> = [];
    captchaPlugin(deps(envWith({ ...keys, APP_URL: "http://localhost:3000" }), local));
    expect(local).toEqual([]);
    const live: Array<string> = [];
    captchaPlugin(deps(envWith({ ...keys, APP_URL: "https://app.example.com" }), live));
    expect(live).toHaveLength(1);
  });
});

describe("signInCaptcha", () => {
  it("guards sign-in only when both keys are set", () => {
    expect(signInCaptcha(envWith({}))).toEqual([]);
    const plugins = signInCaptcha(envWith({ TURNSTILE_SITE_KEY: "s", TURNSTILE_SECRET_KEY: "k" }));
    expect(plugins.map((plugin) => plugin.options)).toMatchObject([
      { endpoints: ["/sign-in/email"] },
    ]);
  });
});

describe("Auth with Turnstile keys", () => {
  let db: Db;
  beforeAll(async () => {
    db = await makeTestDb(authSchema);
  });

  const guarded = {
    ...env,
    TURNSTILE_SITE_KEY: "site",
    TURNSTILE_SECRET_KEY: "secret",
  } as unknown as AppEnv;
  const credentials = { email: "bot@example.com", password: "correct horse battery", name: "B" };
  const siteverify = (success: boolean) =>
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ success }));
  afterEach(() => vi.restoreAllMocks());

  it("refuses a sign-up with no token, before it reaches Cloudflare or the database", async () => {
    const fetched = siteverify(true);
    const { response, events } = await request(
      db,
      post("/api/auth/sign-up/email", credentials),
      true,
      undefined,
      guarded,
    );
    expect(response.status).toBe(400);
    expect(events).toEqual([]);
    expect(fetched).not.toHaveBeenCalled();
  });

  it("refuses a token Cloudflare rejects", async () => {
    siteverify(false);
    const { response } = await request(
      db,
      post("/api/auth/sign-up/email", credentials, { "x-captcha-response": "bad" }),
      true,
      undefined,
      guarded,
    );
    expect(response.status).toBe(403);
  });

  it("signs up with a token Cloudflare accepts, and leaves sign-in alone", async () => {
    const fetched = siteverify(true);
    const signUp = await request(
      db,
      post("/api/auth/sign-up/email", credentials, { "x-captcha-response": "good" }),
      true,
      undefined,
      guarded,
    );
    expect(signUp.response.status).toBe(200);
    expect(String(fetched.mock.calls[0]?.[0])).toContain("/turnstile/v0/siteverify");
    const signIn = await request(
      db,
      post("/api/auth/sign-in/email", credentials),
      true,
      undefined,
      guarded,
    );
    expect(signIn.response.status).toBe(200);
  });

  describe("past the account's sign-in limit", () => {
    const owner = { email: "owner@example.com", password: "correct horse battery", name: "O" };
    const signIn = (headers: Record<string, string> = {}) =>
      request(
        db,
        post("/api/auth/sign-in/email", owner, headers),
        overAccountLimit,
        undefined,
        guarded,
      );
    beforeAll(async () => {
      siteverify(true);
      await request(
        db,
        post("/api/auth/sign-up/email", owner, { "x-captcha-response": "good" }),
        true,
        undefined,
        guarded,
      );
      vi.restoreAllMocks();
    });

    it("asks for a Turnstile token instead of refusing", async () => {
      const fetched = siteverify(true);
      const { response, sent } = await signIn();
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "MISSING_RESPONSE" });
      expect(sent.map((c) => c.event)).toEqual([{ _tag: "sign_in_failed", reason: "challenged" }]);
      expect(fetched).not.toHaveBeenCalled();
    });

    it("lets the owner in with a token Cloudflare accepts", async () => {
      siteverify(true);
      const { response, events } = await signIn({ "x-captcha-response": "good" });
      expect(response.status).toBe(200);
      expect(events).toEqual(["sign_in_succeeded"]);
    });

    it("refuses a token Cloudflare rejects", async () => {
      siteverify(false);
      const { response } = await signIn({ "x-captcha-response": "bad" });
      expect(response.status).toBe(403);
    });

    it("still answers 429 when the address is over its own limit", async () => {
      const { response } = await request(
        db,
        post("/api/auth/sign-in/email", owner, { "x-captcha-response": "good" }),
        false,
        undefined,
        guarded,
      );
      expect(response.status).toBe(429);
    });
  });
});
