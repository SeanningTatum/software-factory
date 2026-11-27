import { and, eq, notExists, sql } from "drizzle-orm";
import { Cause, Context, DateTime, Effect, ErrorReporter, Layer, Schema } from "effect";
import { CloudflareEnv } from "#/app/env.ts";
import { NotConfigured, Unauthorized } from "#/app/errors.ts";
import { CurrentRequest } from "#/app/request.ts";
import { properties } from "#/features/core/analytics/api/adapter.ts";
import { Analytics } from "#/features/core/analytics/api/analytics.ts";
import { clearAnonIdCookie, readAnonId } from "#/features/core/analytics/lib/browser.ts";
import type { AnalyticsEvent } from "#/features/core/analytics/lib/catalog.ts";
import { Database } from "#/features/core/db/api/database.ts";
import { outsideCall } from "#/features/core/lib/call.ts";
import { featureAuthPlugins, featureAuthTables } from "#/gen/auth-plugins.ts";
import { authEvents, SIGN_OUT } from "../lib/auth-events.ts";
import { account, auditLog, user } from "../schema.ts";
import { type AuthLog, type AuthPluginFactory, authConfig, makeAuth } from "./auth.ts";
import { captchaPlugin, signInCaptcha, turnstileKeys } from "./captcha.ts";
import { AuthRateLimiter, accountKey, LIMITED_PATHS, limitKey, SIGN_IN } from "./rate-limit.ts";

const IDENTIFIES = new Set(["sign_up_completed", "sign_in_succeeded"]);
const SIGN_UP = "/api/auth/sign-up/email";
const WEBHOOK = "/api/auth/stripe/webhook";
const SERVER_ERROR = 500;
const RESETS_ANON_ID = new Set([...IDENTIFIES, "signed_out"]);

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
    readonly handle: (
      request: Request,
    ) => Effect.Effect<Response, AuthServiceError | Unauthorized | NotConfigured>;
    readonly currentUser: Effect.Effect<SessionUser | undefined, AuthServiceError>;
    readonly requireUser: Effect.Effect<
      SessionUser,
      AuthServiceError | Unauthorized | NotConfigured
    >;
  }
>()("app/features/auth/Auth") {
  static readonly unconfigured = (setting: string) =>
    Auth.of({
      handle: () => Effect.fail(new NotConfigured({ setting })),
      currentUser: Effect.succeed(undefined),
      requireUser: Effect.fail(new NotConfigured({ setting })),
    });

  static readonly layerWith = (
    factories: ReadonlyArray<AuthPluginFactory>,
    tables: Record<string, unknown> = {},
  ) =>
    Layer.effect(
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

        const pending: Array<readonly [AnalyticsEvent, string | undefined]> = [];
        const warnings: Array<readonly [string, Record<string, unknown>]> = [];
        const errors: Array<string> = [];
        let errorCount = 0;
        const deps = {
          env,
          onEvent: (event: AnalyticsEvent, userId?: string) => void pending.push([event, userId]),
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
        const plugins = [captchaPlugin, ...factories].flatMap((factory) => factory(deps));
        const db = database.db;
        const instance = makeAuth(config, db, plugins, log, tables);

        const audit = Effect.fn("Auth.audit")(function* (event: AnalyticsEvent, actorId?: string) {
          const at = DateTime.toDateUtc(yield* DateTime.now);
          const { info } = request;
          yield* database
            .query("audit.insert", (db) =>
              db.insert(auditLog).values({
                id: crypto.randomUUID(),
                at,
                actorId: actorId ?? info.userId ?? null,
                action: event._tag,
                details: JSON.stringify(properties(event)),
                requestId: info.id,
                ipAddress: info.headers.get("cf-connecting-ip"),
                userAgent: info.headers.get("user-agent")?.slice(0, 256) ?? null,
              }),
            )
            .pipe(
              Effect.catch((error) =>
                Effect.logWarning("audit write failed", { audit: true, action: event._tag, error }),
              ),
            );
        });
        const record = (event: AnalyticsEvent, userId?: string) =>
          Effect.all([analytics.capture(event, userId), audit(event, userId)], { discard: true });

        const flushPending = Effect.suspend(() =>
          Effect.all([
            Effect.forEach(pending.splice(0), ([event, userId]) => record(event, userId), {
              discard: true,
            }),
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

        const recordOutcome = (event: AnalyticsEvent, userId: string | undefined) => {
          const anonId = readAnonId(request.info.headers.get("cookie"));
          const identify =
            anonId && userId && IDENTIFIES.has(event._tag)
              ? analytics.capture({ _tag: "user_identified", anonId: `anon:${anonId}` }, userId)
              : Effect.void;
          return Effect.andThen(record(event, userId), identify);
        };

        const afterResponse = Effect.fn("Auth.afterResponse")(function* (
          method: string,
          path: string,
          response: Response,
        ) {
          const body = response.headers.get("content-type")?.includes("json")
            ? yield* Effect.promise(() =>
                response
                  .clone()
                  .json()
                  .catch(() => null),
              )
            : null;
          const events = authEvents(method, path, response.status, body);
          yield* Effect.forEach(
            events,
            ({ event, distinctId }) => recordOutcome(event, distinctId),
            {
              discard: true,
            },
          );
          if (path === WEBHOOK && response.status >= SERVER_ERROR) pending.length = 0;
          yield* flushPending;
          if (!events.some(({ event }) => RESETS_ANON_ID.has(event._tag))) return response;
          const reset = new Response(response.body, response);
          reset.headers.append("set-cookie", clearAnonIdCookie);
          return reset;
        });

        const emailOf = (incoming: Request) =>
          Effect.promise(() =>
            (incoming.clone().json() as Promise<{ email?: unknown } | null>)
              .then((body) =>
                typeof body?.email === "string" ? body.email.toLowerCase() : undefined,
              )
              .catch(() => undefined),
          );

        const dropHalfSignUp = (email: string | undefined) =>
          email
            ? database
                .query("auth.dropHalfSignUp", (db) =>
                  db.delete(user).where(
                    and(
                      eq(user.email, email),
                      notExists(
                        db
                          .select({ one: sql`1` })
                          .from(account)
                          .where(
                            and(eq(account.userId, user.id), eq(account.providerId, "credential")),
                          ),
                      ),
                    ),
                  ),
                )
                .pipe(
                  Effect.catch((error) =>
                    Effect.logWarning("half sign-up cleanup failed", { error }),
                  ),
                )
            : Effect.void;

        const tooMany = (path: string, retryAfterSeconds: number) =>
          Effect.forEach(
            authEvents("POST", path, 429, null),
            ({ event }) => analytics.capture(event),
            { discard: true },
          ).pipe(
            Effect.as(
              Response.json(
                { message: "Too many attempts. Try again in a minute." },
                { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
              ),
            ),
          );

        /**
         * A refusal, "challenge" to serve the request only with a Turnstile token, or undefined.
         * Anyone can spend an account's sign-in limit with wrong passwords, so past it the owner is
         * asked to prove they're a person rather than refused, whenever Turnstile is set up.
         */
        const admit = Effect.fn("Auth.admit")(function* (incoming: Request, path: string) {
          const byAddress = yield* Effect.result(limiter.check(limitKey(incoming.headers, path)));
          if (byAddress._tag === "Failure")
            return yield* tooMany(path, byAddress.failure.retryAfterSeconds);
          const email = path === SIGN_IN ? yield* emailOf(incoming) : undefined;
          if (!email) return undefined;
          const byAccount = yield* Effect.result(limiter.check(accountKey(email)));
          if (byAccount._tag === "Success") return undefined;
          if (turnstileKeys(env)) return "challenge" as const;
          return yield* tooMany(path, byAccount.failure.retryAfterSeconds);
        });

        const challenging = () =>
          makeAuth(config, db, [...plugins, ...signInCaptcha(env)], log, tables);

        const serve = Effect.fn("Auth.serve")(function* (
          incoming: Request,
          path: string,
          challenge: boolean,
        ) {
          const signUpEmail =
            incoming.method === "POST" && path === SIGN_UP ? yield* emailOf(incoming) : undefined;
          const auth = challenge ? challenging() : instance;
          const response = yield* call("handler", () => auth.handler(incoming)).pipe(
            Effect.tapError(() => dropHalfSignUp(signUpEmail)),
          );
          if (response.status >= SERVER_ERROR) yield* dropHalfSignUp(signUpEmail);
          return response;
        });

        const handle = Effect.fn("Auth.handle")(function* (incoming: Request) {
          const path = new URL(incoming.url).pathname;
          const admission =
            incoming.method === "POST" && LIMITED_PATHS.includes(path)
              ? yield* admit(incoming, path)
              : undefined;
          if (admission instanceof Response) return admission;
          if (path === SIGN_OUT) yield* Effect.result(currentUser);
          const response = yield* serve(incoming, path, admission === "challenge");
          return yield* afterResponse(incoming.method, path, response);
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

  static readonly layer = Auth.layerWith(
    featureAuthPlugins as ReadonlyArray<AuthPluginFactory>,
    featureAuthTables,
  );
}
