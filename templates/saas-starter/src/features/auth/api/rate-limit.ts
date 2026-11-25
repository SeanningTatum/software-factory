import { Context, Effect, Layer } from "effect";
import { CloudflareEnv } from "#/app/env.ts";
import type { RateLimited } from "#/app/errors.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { checkLimit, clientAddress, type Limiter } from "#/features/core/lib/rate-limit.ts";

export class AuthRateLimiter extends Context.Service<
  AuthRateLimiter,
  { readonly check: (key: string) => Effect.Effect<void, RateLimited> }
>()("app/features/auth/AuthRateLimiter") {
  static readonly fromLimiter = (limiter: Limiter | undefined) =>
    AuthRateLimiter.of({ check: (key) => checkLimit(limiter, key) });

  static readonly layer = Layer.effect(
    AuthRateLimiter,
    Effect.gen(function* () {
      const env = yield* CloudflareEnv;
      return AuthRateLimiter.fromLimiter(binding<Limiter>(env, "AUTH_LIMITER"));
    }),
  );
}

/**
 * Paths that take a password or create an account; only these are rate limited. Add
 * `/api/auth/request-password-reset` here once a reset sender is wired.
 */
export const LIMITED_PATHS = ["/api/auth/sign-in/email", "/api/auth/sign-up/email"];

export const limitKey = (headers: Headers, path: string) => `${clientAddress(headers)}:${path}`;
