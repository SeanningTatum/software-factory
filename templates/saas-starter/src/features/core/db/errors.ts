import type { ErrorInfo } from "#/app/errors.ts";
import type { DatabaseError } from "./api/database.ts";

export type Errors = DatabaseError;

export const errorStatus = {
  DatabaseError: { status: 503, message: "The database is unavailable. Try again shortly." },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
