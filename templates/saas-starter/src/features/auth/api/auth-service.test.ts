import { Effect, ErrorReporter, Layer } from "effect";
import { beforeAll, describe, expect, it } from "vitest";
import { type AppEnv, CloudflareEnv } from "#/app/env.ts";
import { CurrentRequest, requestInfoFrom } from "#/app/request.ts";
import type { Captured } from "#/features/core/analytics/api/adapter.ts";
import { Analytics } from "#/features/core/analytics/api/analytics.ts";
import type { Db } from "#/features/core/db/api/database.ts";
import { makeTestDb, testDatabaseLayer } from "#/features/core/db/api/test-database.ts";
import { authSchema } from "../schema.ts";
import { Auth } from "./auth-service.ts";
import { AuthRateLimiter, LIMITED_PATHS } from "./rate-limit.ts";

const APP = "http://localhost:3000";
const env = { APP_URL: APP, BETTER_AUTH_SECRET: "x".repeat(40) } as unknown as AppEnv;

/** Runs one request through a real Auth service on an in-memory database. */
const request = async (db: Db, incoming: Request, allow = true) => {
  const sent: Array<Captured> = [];
  const reported: Array<string> = [];
  const info = requestInfoFrom(incoming);
  const base = Layer.mergeAll(
    CloudflareEnv.layer(env),
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
  const layer = Auth.layer.pipe(
    Layer.provideMerge(Layer.mergeAll(analytics, limiter)),
    Layer.provideMerge(base),
  );
  const response = await Effect.gen(function* () {
    const auth = yield* Auth;
    return yield* auth.handle(incoming);
  }).pipe(Effect.provide(layer), Effect.runPromise);
  return { response, events: sent.map((c) => c.event._tag), info, reported };
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

  it("answers 429 when the limiter says so, without reaching Better Auth", async () => {
    const { response, events } = await request(
      db,
      post("/api/auth/sign-in/email", { email: "a@b.dev", password: "whatever123" }),
      false,
    );
    expect(response.status).toBe(429);
    expect(events).toEqual(["sign_in_failed"]);
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
