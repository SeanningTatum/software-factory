import { eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { beforeAll, describe, expect, it } from "vitest";
import { CloudflareEnv } from "#/app/env.ts";
import { CurrentRequest, requestInfoFrom } from "#/app/request.ts";
import { Analytics } from "#/features/core/analytics/api/analytics.ts";
import type { Db } from "#/features/core/db/api/database.ts";
import { makeTestDb, testDatabaseLayer } from "#/features/core/db/api/test-database.ts";
import { account, auditLog, authSchema, user } from "../schema.ts";
import type { AuthPluginFactory } from "./auth.ts";
import { Auth } from "./auth-service.ts";
import { AuthRateLimiter, LIMITED_PATHS } from "./rate-limit.ts";
import { APP, env, handled, overAccountLimit, post } from "./test-auth.ts";

const request = (...args: Parameters<typeof handled>) => Effect.runPromise(handled(...args));

describe("Auth", () => {
  let db: Db;
  beforeAll(async () => {
    db = await makeTestDb(authSchema);
  });

  it("signs up, then signs in, and records both on the server", async () => {
    const credentials = {
      email: "ada@example.com",
      password: "correct horse battery",
      name: "Ada",
    };
    const signUp = await request(db, post("/api/auth/sign-up/email", credentials));
    expect(signUp.response.status).toBe(200);
    expect(signUp.events).toEqual(["sign_up_completed"]);

    const signIn = await request(db, post("/api/auth/sign-in/email", credentials));
    expect(signIn.response.status).toBe(200);
    expect(signIn.events).toEqual(["sign_in_succeeded"]);
    expect(signIn.response.headers.get("set-cookie")).toContain("better-auth.session_token");
  });

  it("reads the session from the cookie and tags the request with the user", async () => {
    const credentials = {
      email: "lin@example.com",
      password: "correct horse battery",
      name: "Lin",
    };
    const { response } = await request(db, post("/api/auth/sign-up/email", credentials));
    const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
    const incoming = new Request(`${APP}/dashboard`, { headers: { cookie } });
    const info = requestInfoFrom(incoming);
    const user = await Effect.gen(function* () {
      const auth = yield* Auth;
      return yield* auth.currentUser;
    }).pipe(
      Effect.provide(
        Auth.layer.pipe(
          Layer.provideMerge(
            Layer.mergeAll(
              Analytics.layerWith(() => ({ name: "t", send: () => Effect.void })),
              AuthRateLimiter.layer,
            ),
          ),
          Layer.provideMerge(
            Layer.mergeAll(
              CloudflareEnv.layer(env),
              CurrentRequest.layer(info),
              testDatabaseLayer(db),
            ),
          ),
        ),
      ),
      Effect.runPromise,
    );
    expect(user).toMatchObject({ email: "lin@example.com", name: "Lin" });
    expect(info.userId).toBe(user?.id);
  });

  it("records a failed sign-in without the email", async () => {
    const { response, events } = await request(
      db,
      post("/api/auth/sign-in/email", { email: "nobody@example.com", password: "wrong password!" }),
    );
    expect(response.status).toBe(401);
    expect(events).toEqual(["sign_in_failed"]);
  });

  it("leaves one audit row for a sign-in, with who and from where", async () => {
    const credentials = {
      email: "kay@example.com",
      password: "correct horse battery",
      name: "Kay",
    };
    await request(db, post("/api/auth/sign-up/email", credentials));
    const { response, info } = await request(
      db,
      post("/api/auth/sign-in/email", credentials, { "cf-connecting-ip": "203.0.113.9" }),
    );
    const userId = ((await response.json()) as { user: { id: string } }).user.id;
    const rows = await db.select().from(auditLog).where(eq(auditLog.requestId, info.id));
    expect(rows).toMatchObject([
      { action: "sign_in_succeeded", actorId: userId, ipAddress: "203.0.113.9" },
    ]);
    expect(JSON.parse(rows[0]?.details ?? "")).toEqual({ method: "email" });
  });

  it("leaves one audit row for an outcome a plugin reports for a user", async () => {
    const plugin: AuthPluginFactory = ({ onEvent }) => [
      {
        id: "test-plugin-event",
        onRequest: async () => {
          onEvent({ _tag: "signed_out" }, "user-42");
        },
      },
    ];
    const { info, sent } = await request(db, post("/api/auth/ok", {}), true, [plugin]);
    const rows = await db.select().from(auditLog).where(eq(auditLog.requestId, info.id));
    expect(rows).toMatchObject([{ action: "signed_out", actorId: "user-42" }]);
    expect(sent.map((c) => c.distinctId)).toEqual(["user-42"]);
  });

  it("ties a consented anonymous id to the user at sign-up, then starts a new one", async () => {
    const anon = "0b9b8c1e-1d2f-4a3b-9c4d-5e6f7a8b9c0d";
    const { sent, response } = await request(
      db,
      post(
        "/api/auth/sign-up/email",
        { email: "max@example.com", password: "correct horse battery", name: "Max" },
        { cookie: `aid=${anon}` },
      ),
    );
    const userId = sent[0]?.distinctId;
    expect(sent.map((c) => [c.event._tag, c.distinctId])).toEqual([
      ["sign_up_completed", userId],
      ["user_identified", userId],
    ]);
    expect(sent[1]?.event).toEqual({ _tag: "user_identified", anonId: `anon:${anon}` });
    expect(response.headers.getSetCookie().some((c) => c.startsWith("aid=;"))).toBe(true);
  });

  it("records who signed out and starts a new anonymous id", async () => {
    const credentials = {
      email: "ola@example.com",
      password: "correct horse battery",
      name: "Ola",
    };
    const signUp = await request(db, post("/api/auth/sign-up/email", credentials));
    const cookie = signUp.response.headers.get("set-cookie")?.split(";")[0] ?? "";
    const { response, info } = await request(db, post("/api/auth/sign-out", {}, { cookie }));
    const rows = await db.select().from(auditLog).where(eq(auditLog.requestId, info.id));
    expect(rows).toMatchObject([{ action: "signed_out", actorId: signUp.sent[0]?.distinctId }]);
    expect(response.headers.getSetCookie().some((c) => c.startsWith("aid=;"))).toBe(true);
  });

  it("answers 429 when the limiter says so, without reaching Better Auth or the audit log", async () => {
    const { response, events, info } = await request(
      db,
      post("/api/auth/sign-in/email", { email: "a@b.dev", password: "whatever123" }),
      false,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(events).toEqual(["sign_in_failed"]);
    const rows = await db.select().from(auditLog).where(eq(auditLog.requestId, info.id));
    expect(rows).toEqual([]);
  });

  it.each(LIMITED_PATHS.filter((path) => !path.includes("/subscription/")))(
    "rate limits %s, a route Better Auth really serves",
    async (path) => {
      const { response } = await request(db, post(path, {}));
      expect(response.status).not.toBe(404);
    },
  );

  it("limits a sign-in by account as well as by address, with the one limiter", async () => {
    const keys: Array<string> = [];
    await request(
      db,
      post(
        "/api/auth/sign-in/email",
        { email: "Ada@Example.com", password: "whatever123" },
        { "cf-connecting-ip": "2001:db8:1:2:aaaa:bbbb:cccc:dddd" },
      ),
      true,
      undefined,
      env,
      keys,
    );
    expect(keys).toEqual(["2001:db8:1:2::/64:/api/auth/sign-in/email", "acct:ada@example.com"]);
  });

  it("answers 429 when only the account is over its limit and Turnstile is off", async () => {
    const { response } = await request(
      db,
      post("/api/auth/sign-in/email", { email: "ada@example.com", password: "whatever123" }),
      overAccountLimit,
    );
    expect(response.status).toBe(429);
  });

  it("deletes the user when sign-up fails after the user row, so the email can sign up again", async () => {
    const fresh = await makeTestDb(authSchema);
    const failing = new Proxy(fresh, {
      get: (target, key) =>
        key === "insert"
          ? (table: unknown) => {
              if (table === account) throw new Error("D1 down");
              return target.insert(table as typeof user);
            }
          : Reflect.get(target, key).bind?.(target),
    });
    const credentials = { email: "lost@example.com", password: "correct horse battery", name: "L" };
    const first = await request(failing, post("/api/auth/sign-up/email", credentials));
    expect(first.response.status).toBeGreaterThanOrEqual(500);
    expect(await fresh.select().from(user)).toEqual([]);
    const again = await request(fresh, post("/api/auth/sign-up/email", credentials));
    expect(again.response.status).toBe(200);
  });

  it("drops the queued events when a webhook is answered 5xx, so its retry records them once", async () => {
    const retried: AuthPluginFactory = ({ onEvent }) => [
      {
        id: "test-webhook",
        onRequest: async (incoming) => {
          if (!incoming.url.endsWith("/stripe/webhook")) return undefined;
          onEvent({ _tag: "signed_out" }, "u1");
          return { response: new Response("retry", { status: 500 }) };
        },
      },
    ];
    const { response, events } = await request(db, post("/api/auth/stripe/webhook", {}), true, [
      retried,
    ]);
    expect(response.status).toBe(500);
    expect(events).toEqual([]);
  });

  it("sends what Better Auth logs as an error to the error reporter, not the console", async () => {
    const { reported } = await request(
      db,
      post("/api/auth/request-password-reset", { email: "ada@example.com" }),
    );
    expect(reported.join(" ")).toContain("Reset password isn't enabled");
  });
});
