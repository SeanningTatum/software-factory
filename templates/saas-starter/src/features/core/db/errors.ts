import { Schema } from "effect";
import type { ErrorInfo } from "#/app/errors.ts";

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export type Errors = DatabaseError;

export const errorStatus = {
  DatabaseError: { status: 503, message: "The database is unavailable. Try again shortly." },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
