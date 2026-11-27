import { Effect, ErrorReporter, Layer } from "effect";
import { type AppEnv, CloudflareEnv } from "#/app/env.ts";
import { CurrentRequest, requestInfoFrom } from "#/app/request.ts";
import type { Captured } from "#/features/core/analytics/api/adapter.ts";
import { Analytics } from "#/features/core/analytics/api/analytics.ts";
import type { Db } from "#/features/core/db/api/database.ts";
import { testDatabaseLayer } from "#/features/core/db/api/test-database.ts";
import { featureAuthPlugins } from "#/gen/auth-plugins.ts";
import type { AuthPluginFactory } from "./auth.ts";
import { Auth } from "./auth-service.ts";
import { AuthRateLimiter } from "./rate-limit.ts";

export const APP = "http://localhost:3000";
export const env = { APP_URL: APP, BETTER_AUTH_SECRET: "x".repeat(40) } as unknown as AppEnv;

/** One request through `Auth.handle`, with what it sent to analytics and the error reporter. */
export const handled = (
  db: Db,
  incoming: Request,
  allow: boolean | ((key: string) => boolean) = true,
  plugins = featureAuthPlugins as ReadonlyArray<AuthPluginFactory>,
  appEnv = env,
  keys?: Array<string>,
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
    AuthRateLimiter.fromLimiter({
      limit: async ({ key }) => {
        keys?.push(key);
        return { success: typeof allow === "function" ? allow(key) : allow };
      },
    }),
  );
  const layer = Auth.layerWith(plugins).pipe(
    Layer.provideMerge(Layer.mergeAll(analytics, limiter)),
    Layer.provideMerge(base),
  );
  return Effect.gen(function* () {
    const auth = yield* Auth;
    return yield* auth.handle(incoming);
  }).pipe(
    Effect.provide(layer),
    // After provide: analytics sends its buffer when the layer closes.
    Effect.map((response) => ({
      response,
      events: sent.map((c) => c.event._tag),
      sent,
      info,
      reported,
    })),
  );
};

/** A limiter that lets every key through but the account one. */
export const overAccountLimit = (key: string) => !key.startsWith("acct:");

export const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${APP}${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin: APP, ...headers },
  });
