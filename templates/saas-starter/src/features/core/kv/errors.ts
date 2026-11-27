import { Schema } from "effect";
import type { ErrorInfo } from "#/app/errors.ts";

export class KvError extends Schema.TaggedError<KvError>()("KvError", {
  operation: Schema.String,
  key: Schema.String,
  cause: Schema.Defect(),
}) {}

export type Errors = KvError;

export const errorStatus = {
  KvError: { status: 503, message: "Storage is unavailable. Try again shortly." },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
