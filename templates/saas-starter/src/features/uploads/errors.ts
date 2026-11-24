import type { ErrorInfo } from "#/app/errors.ts";
import type { StorageError, UploadRejected } from "./api/uploads.ts";

export type Errors = UploadRejected | StorageError;

export const errorStatus = {
  UploadRejected: { status: 422, message: "That file can't be uploaded." },
  StorageError: { status: 503, message: "File storage is unavailable. Try again shortly." },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
