import type { ErrorInfo } from "#/core/errors.ts";
import type { KvError } from "./key-value.ts";

export type Errors = KvError;

export const errorStatus = {
  KvError: { status: 503, message: "Storage is unavailable. Try again shortly." },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
