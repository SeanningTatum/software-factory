import type { ErrorInfo } from "#/app/errors.ts";
import type { EmailError } from "./api/email.ts";

export type Errors = EmailError;

export const errorStatus = {
  EmailError: { status: 503, message: "We couldn't send that email. Try again shortly." },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
