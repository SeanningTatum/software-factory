import { Schema } from "effect";
import type { ErrorInfo } from "#/app/errors.ts";

export class AuthServiceError extends Schema.TaggedError<AuthServiceError>()("AuthServiceError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

/** The server wants a Turnstile token with this sign-in; the form shows the check from then on. */
export class ChallengeRequired extends Error {}

export type Errors = AuthServiceError;

export const errorStatus = {
  AuthServiceError: {
    status: 500,
    message: "Sign-in is unavailable right now. Try again shortly.",
  },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
