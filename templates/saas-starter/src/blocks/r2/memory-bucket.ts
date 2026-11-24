import type { Bucket } from "./uploads.ts";

/** An in-memory R2 bucket for tests. */
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
          }
        : null;
    },
    delete: async (key) => void store.delete(key),
    list: async ({ prefix }) => ({
      objects: [...store.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, e]) => ({
          key,
          size: e.bytes.byteLength,
          uploaded: new Date(0),
          customMetadata: e.meta,
          httpMetadata: { contentType: e.contentType },
        })),
    }),
  };
  return { bucket, store };
};
