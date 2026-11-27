import { Context, Effect, Layer } from "effect";
import { CloudflareEnv } from "#/app/env.ts";
import type { RateLimited } from "#/app/errors.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { checkLimit, clientAddress, type Limiter } from "#/features/core/lib/rate-limit.ts";
import { SIGN_IN, SIGN_UP } from "../constants.ts";

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

/** Served only with the auth-email feature; each sends a mail or tries a code. */
export const CODE_PATHS = [
  "/api/auth/sign-in/email-otp",
  "/api/auth/email-otp/send-verification-otp",
  "/api/auth/email-otp/verify-email",
  "/api/auth/email-otp/request-password-reset",
  "/api/auth/email-otp/reset-password",
];

export const LIMITED_PATHS = [
  SIGN_IN,
  SIGN_UP,
  "/api/auth/subscription/upgrade",
  "/api/auth/subscription/billing-portal",
  "/api/auth/subscription/cancel",
  "/api/auth/subscription/restore",
];

export const limitKey = (headers: Headers, path: string) => `${clientAddress(headers)}:${path}`;

export const accountKey = (email: string) => `acct:${email.toLowerCase()}`;
