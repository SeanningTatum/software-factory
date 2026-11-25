import type { ErrorInfo } from "#/app/errors.ts";
import type { FileLimitReached, StorageError, UploadRejected } from "./api/uploads.ts";

export type Errors = UploadRejected | FileLimitReached | StorageError;

export const errorStatus = {
  UploadRejected: { status: 422, message: "That file can't be uploaded." },
  FileLimitReached: {
    status: 409,
    message: "You have reached the limit of 1,000 files. Delete some to upload more.",
  },
  StorageError: { status: 503, message: "File storage is unavailable. Try again shortly." },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
