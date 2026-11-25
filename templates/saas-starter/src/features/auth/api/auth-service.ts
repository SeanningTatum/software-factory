import { Cause, Context, Effect, ErrorReporter, Layer, Schema } from "effect";
import { CloudflareEnv } from "#/app/env.ts";
import { NotConfigured, Unauthorized } from "#/app/errors.ts";
import { CurrentRequest } from "#/app/request.ts";
import { Analytics } from "#/features/core/analytics/api/analytics.ts";
import type { AnalyticsEvent } from "#/features/core/analytics/lib/catalog.ts";
import { Database } from "#/features/core/db/api/database.ts";
import { outsideCall } from "#/features/core/lib/call.ts";
import { featureAuthPlugins } from "#/gen/auth-plugins.ts";
import { authEvents } from "../lib/auth-events.ts";
import { type AuthLog, type AuthPluginFactory, authConfig, makeAuth } from "./auth.ts";
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
>()("app/features/auth/Auth") {
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
      const errors: Array<string> = [];
      let errorCount = 0;
      const deps = {
        env,
        onEvent: (event: AnalyticsEvent) => void pending.push(event),
        onWarning: (message: string, details: Record<string, unknown>) =>
          void warnings.push([message, details]),
        loggedErrors: () => errorCount,
      };
      const log: AuthLog = (level, message) => {
        if (level === "error") {
          errorCount++;
          errors.push(message);
        } else if (level === "warn") warnings.push([message, {}]);
      };
      const plugins = (featureAuthPlugins as ReadonlyArray<AuthPluginFactory>).flatMap((factory) =>
        factory(deps),
      );
      const instance = makeAuth(config, database.db, plugins, log);
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
          Effect.forEach(
            errors.splice(0),
            (message) =>
              Effect.logError("auth error", { message }).pipe(
                Effect.andThen(ErrorReporter.report(Cause.die(new Error(message)))),
              ),
            { discard: true },
          ),
        ]),
      );

      const call = <A>(operation: string, run: () => Promise<A>) =>
        outsideCall(
          `auth.${operation}`,
          run,
          (cause) => new AuthServiceError({ operation, cause }),
        );

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
              {
                status: 429,
                headers: { "retry-after": String(limited.failure.retryAfterSeconds) },
              },
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
