import type { ErrorInfo } from "#/core/errors.ts";
import type { AuthServiceError } from "./auth-service.ts";

export type Errors = AuthServiceError;

export const errorStatus = {
  AuthServiceError: {
    status: 500,
    message: "Sign-in is unavailable right now. Try again shortly.",
  },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
