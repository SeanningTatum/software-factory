import { Schema } from "effect";
import type { ErrorInfo } from "#/app/errors.ts";

export class UploadRejected extends Schema.TaggedError<UploadRejected>()("UploadRejected", {
  reason: Schema.Literals(["empty", "too_large", "unsupported_type", "type_mismatch"]),
}) {}

export class FileLimitReached extends Schema.TaggedError<FileLimitReached>()(
  "FileLimitReached",
  {},
) {}

export class StorageError extends Schema.TaggedError<StorageError>()("StorageError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export type Errors = UploadRejected | FileLimitReached | StorageError;

export const errorStatus = {
  UploadRejected: { status: 422, message: "That file can't be uploaded." },
  FileLimitReached: {
    status: 409,
    message: "You have reached the limit of 1,000 files. Delete some to upload more.",
  },
  StorageError: { status: 503, message: "File storage is unavailable. Try again shortly." },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
