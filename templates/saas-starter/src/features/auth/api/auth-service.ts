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
import { captchaPlugin } from "./captcha.ts";
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

  /** Auth with the given plugin factories and their tables; `layer` uses every enabled feature's. */
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
        const instance = makeAuth(config, database.db, plugins, log, tables);

        /** Writes one audit row. A failed write is logged, never the user's problem. */
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
        /** Every auth and billing outcome goes to analytics and to the audit log. */
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

        /** Records an auth outcome and, at sign-up or sign-in, ties the consented anonymous id to it. */
        const recordOutcome = (event: AnalyticsEvent, userId: string | undefined) => {
          const anonId = readAnonId(request.info.headers.get("cookie"));
          const identify =
            anonId && userId && IDENTIFIES.has(event._tag)
              ? analytics.capture({ _tag: "user_identified", anonId: `anon:${anonId}` }, userId)
              : Effect.void;
          return Effect.andThen(record(event, userId), identify);
        };

        /** Records what Better Auth's answer proves happened; a sign-out also resets the anonymous id. */
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
          // A webhook answered 5xx will be retried, and the retry queues the same events again.
          if (path === WEBHOOK && response.status >= SERVER_ERROR) pending.length = 0;
          yield* flushPending;
          if (!events.some(({ event }) => RESETS_ANON_ID.has(event._tag))) return response;
          // A new anonymous id once a session starts or ends, so it is never tied to two users.
          const reset = new Response(response.body, response);
          reset.headers.append("set-cookie", clearAnonIdCookie);
          return reset;
        });

        /** The lower-cased email in a sign-in or sign-up body, read from a copy so Better Auth still gets it. */
        const emailOf = (incoming: Request) =>
          Effect.promise(() =>
            (incoming.clone().json() as Promise<{ email?: unknown } | null>)
              .then((body) =>
                typeof body?.email === "string" ? body.email.toLowerCase() : undefined,
              )
              .catch(() => undefined),
          );

        /**
         * Sign-up is three D1 writes (user, credential account, session) with no transaction. If a
         * 5xx left a user with no password, delete it: re-signing up would say "exists" and there is
         * no password reset.
         */
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

        /** A 429 when the request is over a limit, else undefined. */
        const refuseIfLimited = Effect.fn("Auth.refuseIfLimited")(function* (
          incoming: Request,
          path: string,
        ) {
          // Sign-in is also limited per account, so many addresses cannot guess one password.
          const keys = [limitKey(incoming.headers, path)];
          if (path === SIGN_IN) {
            const email = yield* emailOf(incoming);
            if (email) keys.push(accountKey(email));
          }
          const limited = yield* Effect.result(
            Effect.forEach(keys, (key) => limiter.check(key), { discard: true }),
          );
          if (limited._tag === "Success") return undefined;
          // Analytics only: an audit row per blocked attempt would let a flood grow the table.
          yield* Effect.forEach(
            authEvents("POST", path, 429, null),
            ({ event }) => analytics.capture(event),
            { discard: true },
          );
          return Response.json(
            { message: "Too many attempts. Try again in a minute." },
            { status: 429, headers: { "retry-after": String(limited.failure.retryAfterSeconds) } },
          );
        });

        /** Better Auth's answer, cleaning up after a sign-up that failed part way. */
        const serve = Effect.fn("Auth.serve")(function* (incoming: Request, path: string) {
          const signUpEmail =
            incoming.method === "POST" && path === SIGN_UP ? yield* emailOf(incoming) : undefined;
          const response = yield* call("handler", () => instance.handler(incoming)).pipe(
            Effect.tapError(() => dropHalfSignUp(signUpEmail)),
          );
          if (response.status >= SERVER_ERROR) yield* dropHalfSignUp(signUpEmail);
          return response;
        });

        const handle = Effect.fn("Auth.handle")(function* (incoming: Request) {
          const path = new URL(incoming.url).pathname;
          if (incoming.method === "POST" && LIMITED_PATHS.includes(path)) {
            const refused = yield* refuseIfLimited(incoming, path);
            if (refused) return refused;
          }
          // Sign-out ends the session, so read whose it was first.
          if (path === SIGN_OUT) yield* Effect.result(currentUser);
          const response = yield* serve(incoming, path);
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
