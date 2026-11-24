import type { KvNamespace } from "./key-value.ts";

/** An in-memory KV namespace for tests. */
export const memoryNamespace = () => {
  const store = new Map<string, { value: string; ttl?: number }>();
  const kv: KvNamespace = {
    get: async (key) => store.get(key)?.value ?? null,
    put: async (key, value, options) => void store.set(key, { value, ttl: options?.expirationTtl }),
    delete: async (key) => void store.delete(key),
  };
  return { kv, store };
};
