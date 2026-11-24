import { Context, DateTime, Effect, Layer, Schema } from "effect";
import { CloudflareEnv } from "#/core/env.ts";
import { NotConfigured, NotFound, RateLimited } from "#/core/errors.ts";
import { type AllowedType, check, type Rejection } from "./validate.ts";

export class UploadRejected extends Schema.TaggedError<UploadRejected>()("UploadRejected", {
  reason: Schema.Literals(["empty", "too_large", "unsupported_type", "type_mismatch"]),
}) {}

export class StorageError extends Schema.TaggedError<StorageError>()("StorageError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export interface StoredFile {
  readonly key: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
  readonly uploadedAt: string;
}

/** The parts of the R2 and rate-limit bindings the service uses. */
export interface Bucket {
  put(
    key: string,
    value: ArrayBuffer,
    options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> },
  ): Promise<unknown>;
  get(
    key: string,
  ): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
  list(options: {
    prefix: string;
    limit: number;
    include?: Array<"customMetadata" | "httpMetadata">;
  }): Promise<{
    objects: Array<{
      key: string;
      size: number;
      uploaded: Date;
      customMetadata?: Record<string, string>;
      httpMetadata?: { contentType?: string };
    }>;
  }>;
}
interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

const LIST_LIMIT = 100;
const HEAD_BYTES = 16;
const NAME_MAX = 200;
const RETRY_SECONDS = 60;

/** Every user's files live under their own prefix, so one user can never name another's file. */
export const prefixFor = (userId: string) => `users/${userId}/`;
const safeName = (name: string) => name.replace(/[^\w.\- ]+/g, "_").slice(0, NAME_MAX) || "file";

export class Uploads extends Context.Service<
  Uploads,
  {
    readonly upload: (
      userId: string,
      file: File,
    ) => Effect.Effect<StoredFile, UploadRejected | StorageError | RateLimited | NotConfigured>;
    readonly list: (
      userId: string,
    ) => Effect.Effect<ReadonlyArray<StoredFile>, StorageError | NotConfigured>;
    readonly download: (
      userId: string,
      id: string,
    ) => Effect.Effect<Response, StorageError | NotFound | NotConfigured>;
    readonly remove: (
      userId: string,
      id: string,
    ) => Effect.Effect<void, StorageError | NotConfigured>;
  }
>()("app/blocks/r2/Uploads") {
  static readonly make = (bucket: Bucket, limiter: Limiter | undefined) => {
    const call = <A>(operation: string, run: () => Promise<A>) =>
      Effect.tryPromise({
        try: run,
        catch: (cause) => new StorageError({ operation, cause }),
      }).pipe(Effect.withSpan(`r2.${operation}`, { kind: "client" }));
    const reject = (reason: Rejection) => new UploadRejected({ reason });

    const upload = Effect.fn("Uploads.upload")(function* (userId: string, file: File) {
      if (limiter) {
        const { success } = yield* call("ratelimit", () => limiter.limit({ key: userId }));
        if (!success) return yield* new RateLimited({ retryAfterSeconds: RETRY_SECONDS });
      }
      const early = check(file);
      if (early) return yield* reject(early);
      const bytes = yield* call("read", () => file.arrayBuffer());
      const late = check(file, new Uint8Array(bytes.slice(0, HEAD_BYTES)));
      if (late) return yield* reject(late);
      const key = `${prefixFor(userId)}${crypto.randomUUID()}`;
      const name = safeName(file.name);
      const uploadedAt = DateTime.formatIso(yield* DateTime.now);
      yield* call("put", () =>
        bucket.put(key, bytes, {
          httpMetadata: { contentType: file.type },
          customMetadata: { name, uploadedAt },
        }),
      );
      return { key, name, contentType: file.type as AllowedType, size: file.size, uploadedAt };
    });

    const list = Effect.fn("Uploads.list")(function* (userId: string) {
      const { objects } = yield* call("list", () =>
        bucket.list({
          prefix: prefixFor(userId),
          limit: LIST_LIMIT,
          include: ["customMetadata", "httpMetadata"],
        }),
      );
      return objects.map((o) => ({
        key: o.key,
        name: o.customMetadata?.name ?? "file",
        contentType: o.httpMetadata?.contentType ?? "application/octet-stream",
        size: o.size,
        uploadedAt: o.customMetadata?.uploadedAt ?? o.uploaded.toISOString(),
      }));
    });

    const download = Effect.fn("Uploads.download")(function* (userId: string, id: string) {
      const object = yield* call("get", () => bucket.get(`${prefixFor(userId)}${id}`));
      if (!object) return yield* new NotFound({ what: "file" });
      return new Response(object.body, {
        headers: {
          "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
          "content-disposition": "attachment",
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
      const env = (yield* CloudflareEnv) as unknown as {
        BUCKET?: Bucket;
        UPLOAD_LIMITER?: Limiter;
      };
      if (env.BUCKET) return Uploads.make(env.BUCKET, env.UPLOAD_LIMITER);
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
