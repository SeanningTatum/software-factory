import { Context, DateTime, Effect, Layer, Schema } from "effect";
import { CloudflareEnv } from "#/app/env.ts";
import { NotConfigured, NotFound, type RateLimited } from "#/app/errors.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { outsideCall } from "#/features/core/lib/call.ts";
import { checkLimit, type Limiter } from "#/features/core/lib/rate-limit.ts";
import { MAX_FILES_PER_USER, PAGE_SIZE } from "../constants.ts";
import { type AllowedType, check, type Rejection } from "../lib/validate.ts";

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

export interface StoredFile {
  /** The file's id within its owner's files: what /api/uploads/$id takes. */
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
  readonly uploadedAt: string;
}

export interface FilePage {
  readonly files: ReadonlyArray<StoredFile>;
  readonly cursor: string | undefined;
}

/** The parts of the R2 and rate-limit bindings the service uses. */
export interface Bucket {
  put(
    key: string,
    value: ArrayBuffer,
    options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> },
  ): Promise<unknown>;
  get(key: string): Promise<{
    body: ReadableStream;
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  } | null>;
  delete(key: string): Promise<void>;
  list(options: {
    prefix: string;
    limit: number;
    cursor?: string;
    include?: Array<"customMetadata" | "httpMetadata">;
  }): Promise<{
    truncated: boolean;
    cursor?: string;
    objects: Array<{
      key: string;
      size: number;
      uploaded: Date;
      customMetadata?: Record<string, string>;
      httpMetadata?: { contentType?: string };
    }>;
  }>;
}
const HEAD_BYTES = 16;
const NAME_MAX = 200;

/** Every user's files live under their own prefix, so one user can never name another's file. */
const prefixFor = (userId: string) => `users/${userId}/`;
/**
 * R2 lists keys in order, so a key starts with its time counted down: the newest file sorts first
 * on every page. Thirteen digits last until the year 2286.
 */
const newestFirst = (millis: number) => String(9_999_999_999_999 - millis).padStart(13, "0");
const safeName = (name: string) => name.replace(/[^\w.\- ]+/g, "_").slice(0, NAME_MAX) || "file";

export class Uploads extends Context.Service<
  Uploads,
  {
    readonly upload: (
      userId: string,
      file: File,
    ) => Effect.Effect<
      StoredFile,
      UploadRejected | FileLimitReached | StorageError | RateLimited | NotConfigured
    >;
    /** One page of files, with the cursor for the next page when there is one. */
    readonly list: (
      userId: string,
      cursor?: string,
    ) => Effect.Effect<FilePage, StorageError | NotConfigured>;
    readonly download: (
      userId: string,
      id: string,
    ) => Effect.Effect<Response, StorageError | NotFound | NotConfigured>;
    readonly remove: (
      userId: string,
      id: string,
    ) => Effect.Effect<void, StorageError | NotConfigured>;
  }
>()("app/features/uploads/Uploads") {
  static readonly make = (bucket: Bucket, limiter: Limiter | undefined) => {
    const call = <A>(operation: string, run: () => Promise<A>) =>
      outsideCall(`r2.${operation}`, run, (cause) => new StorageError({ operation, cause }));
    const reject = (reason: Rejection) => new UploadRejected({ reason });

    const upload = Effect.fn("Uploads.upload")(function* (userId: string, file: File) {
      yield* checkLimit(limiter, userId);
      const early = check(file);
      if (early) return yield* reject(early);
      // One keys-only list call, capped at the limit: R2 stops there however many files exist.
      const held = yield* call("count", () =>
        bucket.list({ prefix: prefixFor(userId), limit: MAX_FILES_PER_USER }),
      );
      if (held.objects.length >= MAX_FILES_PER_USER) return yield* new FileLimitReached();
      const bytes = yield* call("read", () => file.arrayBuffer());
      const late = check(file, new Uint8Array(bytes.slice(0, HEAD_BYTES)));
      if (late) return yield* reject(late);
      const now = yield* DateTime.now;
      const id = `${newestFirst(DateTime.toEpochMillis(now))}-${crypto.randomUUID()}`;
      const key = `${prefixFor(userId)}${id}`;
      const name = safeName(file.name);
      const uploadedAt = DateTime.formatIso(now);
      yield* call("put", () =>
        bucket.put(key, bytes, {
          httpMetadata: { contentType: file.type },
          customMetadata: { name, uploadedAt },
        }),
      );
      return { id, name, contentType: file.type as AllowedType, size: file.size, uploadedAt };
    });

    const list = Effect.fn("Uploads.list")(function* (userId: string, cursor?: string) {
      const prefix = prefixFor(userId);
      const page = yield* call("list", () =>
        bucket.list({
          prefix,
          limit: PAGE_SIZE,
          include: ["customMetadata", "httpMetadata"],
          ...(cursor ? { cursor } : {}),
        }),
      );
      const files = page.objects.map((o) => ({
        id: o.key.slice(prefix.length),
        name: o.customMetadata?.name ?? "file",
        contentType: o.httpMetadata?.contentType ?? "application/octet-stream",
        size: o.size,
        uploadedAt: o.customMetadata?.uploadedAt ?? o.uploaded.toISOString(),
      }));
      return { files, cursor: page.truncated ? page.cursor : undefined };
    });

    const download = Effect.fn("Uploads.download")(function* (userId: string, id: string) {
      const object = yield* call("get", () => bucket.get(`${prefixFor(userId)}${id}`));
      if (!object) return yield* new NotFound({ what: "file" });
      return new Response(object.body, {
        headers: {
          "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
          // The name was reduced to [\w.\- ] at upload, so it is safe inside the quotes.
          "content-disposition": `attachment; filename="${object.customMetadata?.name ?? "file"}"`,
          "x-content-type-options": "nosniff",
        },
      });
    });

    const remove = (userId: string, id: string) =>
      call("delete", () => bucket.delete(`${prefixFor(userId)}${id}`));

    return Uploads.of({ upload, list, download, remove });
  };

  static readonly layer = Layer.effect(
    Uploads,
    Effect.gen(function* () {
      const env = yield* CloudflareEnv;
      const bucket = binding<Bucket>(env, "BUCKET");
      if (bucket) return Uploads.make(bucket, binding<Limiter>(env, "UPLOAD_LIMITER"));
      const missing = Effect.fail(new NotConfigured({ setting: "BUCKET (R2 binding)" }));
      return Uploads.of({
        upload: () => missing,
        list: () => missing,
        download: () => missing,
        remove: () => missing,
      });
    }),
  );
}
