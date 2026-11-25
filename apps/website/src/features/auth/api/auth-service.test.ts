import { eq } from "drizzle-orm";
import { Effect, ErrorReporter, Layer } from "effect";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type AppEnv, CloudflareEnv } from "#/app/env.ts";
import { CurrentRequest, requestInfoFrom } from "#/app/request.ts";
import type { Captured } from "#/features/core/analytics/api/adapter.ts";
import { Analytics } from "#/features/core/analytics/api/analytics.ts";
import type { Db } from "#/features/core/db/api/database.ts";
import { makeTestDb, testDatabaseLayer } from "#/features/core/db/api/test-database.ts";
import { featureAuthPlugins } from "#/gen/auth-plugins.ts";
import { auditLog, authSchema } from "../schema.ts";
import type { AuthPluginFactory } from "./auth.ts";
import { Auth } from "./auth-service.ts";
import { AuthRateLimiter, LIMITED_PATHS } from "./rate-limit.ts";

const APP = "http://localhost:3000";
const env = { APP_URL: APP, BETTER_AUTH_SECRET: "x".repeat(40) } as unknown as AppEnv;

/** Runs one request through a real Auth service on an in-memory database. */
const request = async (
  db: Db,
  incoming: Request,
  allow = true,
  plugins = featureAuthPlugins as ReadonlyArray<AuthPluginFactory>,
  appEnv = env,
) => {
  const sent: Array<Captured> = [];
  const reported: Array<string> = [];
  const info = requestInfoFrom(incoming);
  const base = Layer.mergeAll(
    CloudflareEnv.layer(appEnv),
    CurrentRequest.layer(info),
    testDatabaseLayer(db),
    ErrorReporter.layer([ErrorReporter.make(({ error }) => void reported.push(error.message))]),
  );
  const analytics = Analytics.layerWith(() => ({
    name: "test",
    send: (batch) => Effect.sync(() => void sent.push(...batch)),
  }));
  const limiter = Layer.succeed(AuthRateLimiter)(
    AuthRateLimiter.fromLimiter({ limit: async () => ({ success: allow }) }),
  );
  const layer = Auth.layerWith(plugins).pipe(
    Layer.provideMerge(Layer.mergeAll(analytics, limiter)),
    Layer.provideMerge(base),
  );
  const response = await Effect.gen(function* () {
    const auth = yield* Auth;
    return yield* auth.handle(incoming);
  }).pipe(Effect.provide(layer), Effect.runPromise);
  return { response, events: sent.map((c) => c.event._tag), sent, info, reported };
};

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${APP}${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin: APP, ...headers },
  });

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

  describe("with Turnstile keys", () => {
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

  // Billing's plan changes take this path, with the subscription's user id; auth can ship without
  // billing, so the test sends an auth event.
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

  it("answers 429 when the limiter says so, without reaching Better Auth", async () => {
    const { response, events, info } = await request(
      db,
      post("/api/auth/sign-in/email", { email: "a@b.dev", password: "whatever123" }),
      false,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(events).toEqual(["sign_in_failed"]);
    // A flood of blocked attempts must not grow the audit log.
    const rows = await db.select().from(auditLog).where(eq(auditLog.requestId, info.id));
    expect(rows).toEqual([]);
  });

  it.each(LIMITED_PATHS)("rate limits %s, a route Better Auth really serves", async (path) => {
    const { response } = await request(db, post(path, {}));
    expect(response.status).not.toBe(404);
  });

  it("sends what Better Auth logs as an error to the error reporter, not the console", async () => {
    const { reported } = await request(
      db,
      post("/api/auth/request-password-reset", { email: "ada@example.com" }),
    );
    expect(reported.join(" ")).toContain("Reset password isn't enabled");
  });
});
