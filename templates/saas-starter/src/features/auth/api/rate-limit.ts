import { Context, Effect, Layer } from "effect";
import { CloudflareEnv } from "#/app/env.ts";
import { RateLimited } from "#/app/errors.ts";

const WINDOW_SECONDS = 60;

/** The part of a Workers rate-limit binding we use. */
export interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export class AuthRateLimiter extends Context.Service<
  AuthRateLimiter,
  { readonly check: (key: string) => Effect.Effect<void, RateLimited> }
>()("app/features/auth/AuthRateLimiter") {
  static readonly fromLimiter = (limiter: Limiter | undefined) =>
    AuthRateLimiter.of({
      check: (key) =>
        limiter
          ? Effect.tryPromise(() => limiter.limit({ key })).pipe(
              Effect.withSpan("AuthRateLimiter.check"),
              // A limiter outage should not lock everyone out.
              Effect.catch(() => Effect.succeed({ success: true })),
              Effect.flatMap(({ success }) =>
                success
                  ? Effect.void
                  : Effect.fail(new RateLimited({ retryAfterSeconds: WINDOW_SECONDS })),
              ),
            )
          : Effect.void,
    });

  static readonly layer = Layer.effect(
    AuthRateLimiter,
    Effect.gen(function* () {
      const env = yield* CloudflareEnv;
      return AuthRateLimiter.fromLimiter(
        (env as unknown as { AUTH_LIMITER?: Limiter }).AUTH_LIMITER,
      );
    }),
  );
}

/** Paths that take a password or create an account; only these are rate limited. */
export const LIMITED_PATHS = [
  "/api/auth/sign-in/email",
  "/api/auth/sign-up/email",
  "/api/auth/forget-password",
];

export const limitKey = (headers: Headers, path: string) =>
  `${headers.get("cf-connecting-ip") ?? "unknown"}:${path}`;
