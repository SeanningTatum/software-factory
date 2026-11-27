import { Schema } from "effect";
import type { ErrorInfo } from "#/app/errors.ts";

export class EmailError extends Schema.TaggedError<EmailError>()("EmailError", {
  code: Schema.String,
  cause: Schema.Defect(),
}) {}

export type Errors = EmailError;

export const errorStatus = {
  EmailError: { status: 503, message: "We couldn't send that email. Try again shortly." },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
