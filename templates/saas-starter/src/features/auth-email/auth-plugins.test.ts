import { Effect } from "effect";
import { beforeAll, describe, expect, it } from "vitest";
import type { AppEnv } from "#/app/env.ts";
import { env, handled, post } from "#/features/auth/api/test-auth.ts";
import { CODE_PATHS } from "#/features/auth/constants.ts";
import { authSchema } from "#/features/auth/schema.ts";
import type { Db } from "#/features/core/db/api/database.ts";
import { makeTestDb } from "#/features/core/db/api/test-database.ts";
import type { Mail } from "#/features/core/email/api/email.ts";
import { authEmailPlugins, authPlugins } from "./auth-plugins.ts";

const PASSWORD = "correct horse battery";
const deps = (env: Record<string, unknown>) => ({
  env: env as unknown as AppEnv,
  onEvent: () => undefined,
  onWarning: () => undefined,
  loggedErrors: () => 0,
});

describe("auth-email plugins", () => {
  it("stay off until email can send, so auth works as it does without email", () => {
    expect(authPlugins(deps({}))).toEqual([]);
    expect(authPlugins(deps({ EMAIL: {} }))).toEqual([]);
    expect(authPlugins(deps({ EMAIL: {}, EMAIL_FROM: "a@b.co" })).map((p) => p.id)).toEqual([
      "email-otp",
      "require-verified-email",
    ]);
  });
});

describe("auth with email", () => {
  let db: Db;
  const sent: Array<Mail> = [];
  const plugins = [() => authEmailPlugins(async (mail) => void sent.push(mail))];
  const call = (path: string, body: unknown) =>
    Effect.runPromise(handled(db, post(path, body), true, plugins));
  const codeFor = (email: string) => {
    const mail = sent.findLast((m) => m.to === email);
    return /\d{6}/.exec(mail?.text ?? "")?.[0];
  };
  const signUp = (email: string) =>
    call("/api/auth/sign-up/email", { email, password: PASSWORD, name: "Ada" });

  beforeAll(async () => {
    db = await makeTestDb(authSchema);
  });

  it.each(CODE_PATHS)("serves and rate limits %s", async (path) => {
    const served = await call(path, {});
    expect(served.response.status).not.toBe(404);
    const limited = await Effect.runPromise(handled(db, post(path, {}), false, plugins));
    expect(limited.response.status).toBe(429);
  });

  it("holds a new account at the door until its address is verified by code", async () => {
    const email = "ada@example.com";
    const signedUp = await signUp(email);
    expect(signedUp.response.headers.get("set-cookie") ?? "").not.toContain("session_token");
    const early = await call("/api/auth/sign-in/email", { email, password: PASSWORD });
    expect(early.response.status).toBe(403);

    const verified = await call("/api/auth/email-otp/verify-email", { email, otp: codeFor(email) });
    expect(verified.response.status).toBe(200);
    expect(verified.response.headers.get("set-cookie")).toContain("session_token");
    expect(verified.events).toEqual(["email_verified"]);
    const later = await call("/api/auth/sign-in/email", { email, password: PASSWORD });
    expect(later.response.status).toBe(200);
  });

  it("resets a password with a mailed code, and refuses a wrong one", async () => {
    const email = "lin@example.com";
    await signUp(email);
    await call("/api/auth/email-otp/request-password-reset", { email });
    const otp = codeFor(email);
    const reset = (code: string | undefined) =>
      call("/api/auth/email-otp/reset-password", {
        email,
        otp: code,
        password: "a brand new secret",
      });
    expect((await reset("000000")).response.status).toBe(400);
    const done = await reset(otp);
    expect(done.response.status).toBe(200);
    expect(done.events).toEqual(["password_reset"]);
  });

  it("signs in with a mailed code, and mails nothing to an address with no account", async () => {
    const email = "kay@example.com";
    await signUp(email);
    await call("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
    const signedIn = await call("/api/auth/sign-in/email-otp", { email, otp: codeFor(email) });
    expect(signedIn.response.status).toBe(200);
    expect(signedIn.events).toEqual(["sign_in_succeeded"]);

    const before = sent.length;
    await call("/api/auth/email-otp/send-verification-otp", {
      email: "nobody@example.com",
      type: "sign-in",
    });
    expect(sent.length).toBe(before);
  });

  it("warns with Email Service's code when a send fails, since the answer is success either way", async () => {
    const warnings: Array<Record<string, unknown>> = [];
    const refused = Object.assign(new Error("no"), { code: "E_DAILY_LIMIT_EXCEEDED" });
    const appEnv = {
      ...env,
      EMAIL: { send: () => Promise.reject(refused) },
      EMAIL_FROM: "hello@example.com",
    } as unknown as AppEnv;
    const plugins = [
      (d: Parameters<typeof authPlugins>[0]) =>
        authPlugins({ ...d, onWarning: (_message, details) => void warnings.push(details) }),
    ];
    const body = { email: "kay@example.com", type: "sign-in" };
    const { response } = await Effect.runPromise(
      handled(db, post("/api/auth/email-otp/send-verification-otp", body), true, plugins, appEnv),
    );
    expect(response.status).toBe(200);
    expect(warnings).toEqual([{ error: "EmailError", reason: "E_DAILY_LIMIT_EXCEEDED" }]);
  });
});
