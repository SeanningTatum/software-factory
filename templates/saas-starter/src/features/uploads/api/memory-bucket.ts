// cf-saas-lint allow comments
import type { Bucket } from "./uploads.ts";

export const memoryBucket = () => {
  const store = new Map<
    string,
    { bytes: ArrayBuffer; contentType: string; meta: Record<string, string> }
  >();
  const bucket: Bucket = {
    put: async (key, value, options) =>
      void store.set(key, {
        bytes: value,
        contentType: options.httpMetadata.contentType,
        meta: options.customMetadata,
      }),
    get: async (key) => {
      const entry = store.get(key);
      return entry
        ? {
            body: new Response(entry.bytes).body as ReadableStream,
            httpMetadata: { contentType: entry.contentType },
            customMetadata: entry.meta,
          }
        : null;
    },
    delete: async (key) => void store.delete(key),
    list: async ({ prefix, limit, cursor }) => {
      const keys = [...store.keys()]
        .filter((key) => key.startsWith(prefix) && (!cursor || key > cursor))
        // R2 lists keys in byte order, the same order the cursor check uses.
        .sort((a, b) => Number(a > b) - Number(a < b));
      const page = keys.slice(0, limit);
      return {
        truncated: keys.length > limit,
        ...(keys.length > limit ? { cursor: page.at(-1) } : {}),
        objects: page.map((key) => {
          const e = store.get(key) as {
            bytes: ArrayBuffer;
            contentType: string;
            meta: Record<string, string>;
          };
          return {
            key,
            size: e.bytes.byteLength,
            uploaded: new Date(0),
            customMetadata: e.meta,
            httpMetadata: { contentType: e.contentType },
          };
        }),
      };
    },
  };
  return { bucket, store };
};
