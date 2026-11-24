import { Context, Effect, Layer, Schema } from "effect";
import { Database } from "#/blocks/d1/database.ts";
import { Analytics } from "#/core/analytics/analytics.ts";
import type { AnalyticsEvent } from "#/core/analytics/events.ts";
import { CloudflareEnv } from "#/core/env.ts";
import { NotConfigured, Unauthorized } from "#/core/errors.ts";
import { CurrentRequest } from "#/core/request.ts";
import { blockAuthPlugins } from "#/gen/auth-plugins.ts";
import { type AuthPluginFactory, authConfig, makeAuth } from "./auth.ts";
import { authEvents } from "./auth-events.ts";
import { AuthRateLimiter, LIMITED_PATHS, limitKey } from "./rate-limit.ts";

export class AuthServiceError extends Schema.TaggedError<AuthServiceError>()("AuthServiceError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export class Auth extends Context.Service<
  Auth,
  {
    /** Serves /api/auth/*: rate limits password paths and records what happened. */
    readonly handle: (
      request: Request,
    ) => Effect.Effect<Response, AuthServiceError | Unauthorized | NotConfigured>;
    /** The signed-in user, or undefined. Also tags the request's logs with the user id. */
    readonly currentUser: Effect.Effect<SessionUser | undefined, AuthServiceError>;
    readonly requireUser: Effect.Effect<
      SessionUser,
      AuthServiceError | Unauthorized | NotConfigured
    >;
  }
>()("app/blocks/auth/Auth") {
  /**
   * Auth without its settings: everyone is signed out, and the auth API answers 503 naming what is
   * missing. The rest of the app keeps working.
   */
  static readonly unconfigured = (setting: string) =>
    Auth.of({
      handle: () => Effect.fail(new NotConfigured({ setting })),
      currentUser: Effect.succeed(undefined),
      requireUser: Effect.fail(new NotConfigured({ setting })),
    });

  static readonly layer = Layer.effect(
    Auth,
    Effect.gen(function* () {
      const env = yield* CloudflareEnv;
      const database = yield* Database;
      const request = yield* CurrentRequest;
      const analytics = yield* Analytics;
      const limiter = yield* AuthRateLimiter;

      const config = authConfig(env);
      if ("missing" in config) return Auth.unconfigured(config.missing);
      if (!database.db) return Auth.unconfigured("DB (D1 binding)");

      const pending: Array<AnalyticsEvent> = [];
      const warnings: Array<readonly [string, Record<string, unknown>]> = [];
      const deps = {
        env,
        onEvent: (event: AnalyticsEvent) => void pending.push(event),
        onWarning: (message: string, details: Record<string, unknown>) =>
          void warnings.push([message, details]),
      };
      const plugins = (blockAuthPlugins as ReadonlyArray<AuthPluginFactory>).flatMap((factory) =>
        factory(deps),
      );
      const instance = makeAuth(config, database.db, plugins);
      const flushPending = Effect.suspend(() =>
        Effect.all([
          Effect.forEach(pending.splice(0), (event) => analytics.capture(event), { discard: true }),
          Effect.forEach(
            warnings.splice(0),
            ([message, details]) => Effect.logWarning(message, details),
            {
              discard: true,
            },
          ),
        ]),
      );

      const call = <A>(operation: string, run: () => Promise<A>) =>
        Effect.tryPromise({
          try: run,
          catch: (cause) => new AuthServiceError({ operation, cause }),
        }).pipe(Effect.withSpan(`auth.${operation}`, { kind: "client" }));

      const currentUser = call("getSession", () =>
        instance.api.getSession({ headers: request.info.headers }),
      ).pipe(
        Effect.map((session) =>
          session
            ? { id: session.user.id, email: session.user.email, name: session.user.name }
            : undefined,
        ),
        Effect.tap((user) => request.setUser(user?.id)),
      );

      const handle = Effect.fn("Auth.handle")(function* (incoming: Request) {
        const path = new URL(incoming.url).pathname;
        if (incoming.method === "POST" && LIMITED_PATHS.includes(path)) {
          const limited = yield* Effect.result(limiter.check(limitKey(incoming.headers, path)));
          if (limited._tag === "Failure") {
            for (const { event } of authEvents("POST", path, 429, null))
              yield* analytics.capture(event);
            return Response.json(
              { message: "Too many attempts. Try again in a minute." },
              { status: 429 },
            );
          }
        }
        const response = yield* call("handler", () => instance.handler(incoming));
        const body = response.headers.get("content-type")?.includes("json")
          ? yield* Effect.promise(() =>
              response
                .clone()
                .json()
                .catch(() => null),
            )
          : null;
        for (const { event, distinctId } of authEvents(
          incoming.method,
          path,
          response.status,
          body,
        )) {
          yield* analytics.capture(event, distinctId);
        }
        yield* flushPending;
        return response;
      });

      return Auth.of({
        handle,
        currentUser,
        requireUser: Effect.flatMap(currentUser, (user) =>
          user ? Effect.succeed(user) : Effect.fail(new Unauthorized()),
        ),
      });
    }),
  );
}
