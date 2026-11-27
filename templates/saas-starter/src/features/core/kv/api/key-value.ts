import { Context, Effect, Layer, Option, Schema } from "effect";
import { CloudflareEnv } from "#/app/env.ts";
import { NotConfigured } from "#/app/errors.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { outsideCall } from "#/features/core/lib/call.ts";

export interface KvNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export class KvError extends Schema.TaggedError<KvError>()("KvError", {
  operation: Schema.String,
  key: Schema.String,
  cause: Schema.Defect(),
}) {}

/** KV's own floor for expiring keys. */
const MIN_TTL_SECONDS = 60;

const codec = <S extends Schema.Codec<unknown, unknown>>(schema: S) =>
  Schema.fromJsonString(schema);

export class KeyValue extends Context.Service<
  KeyValue,
  {
    readonly get: <A, I>(
      key: string,
      schema: Schema.Codec<A, I>,
    ) => Effect.Effect<Option.Option<A>, KvError | NotConfigured>;
    readonly set: <A, I>(
      key: string,
      schema: Schema.Codec<A, I>,
      value: A,
      ttlSeconds?: number,
    ) => Effect.Effect<void, KvError | NotConfigured>;
    readonly remove: (key: string) => Effect.Effect<void, KvError | NotConfigured>;
  }
>()("app/features/kv/KeyValue") {
  static readonly fromNamespace = (kv: KvNamespace) => {
    const call = <A>(operation: string, key: string, run: () => Promise<A>) =>
      outsideCall(`kv.${operation}`, run, (cause) => new KvError({ operation, key, cause }), {
        key,
      });
    return KeyValue.of({
      get: (key, schema) =>
        call("get", key, () => kv.get(key)).pipe(
          Effect.flatMap((raw) =>
            raw === null
              ? Effect.succeedNone
              : Schema.decodeUnknownEffect(codec(schema))(raw).pipe(
                  Effect.map(Option.some),
                  // A value written by an older schema is treated as a miss, not an error.
                  Effect.catch(() => Effect.succeedNone),
                ),
          ),
        ),
      set: (key, schema, value, ttlSeconds) =>
        Schema.encodeEffect(codec(schema))(value).pipe(
          Effect.orDie,
          Effect.flatMap((text) =>
            call("put", key, () =>
              kv.put(
                key,
                text,
                ttlSeconds ? { expirationTtl: Math.max(ttlSeconds, MIN_TTL_SECONDS) } : undefined,
              ),
            ),
          ),
        ),
      remove: (key) => call("delete", key, () => kv.delete(key)),
    });
  };

  static readonly layer = Layer.effect(
    KeyValue,
    Effect.gen(function* () {
      const env = yield* CloudflareEnv;
      const kv = binding<KvNamespace>(env, "KV");
      if (kv) return KeyValue.fromNamespace(kv);
      const missing = Effect.fail(new NotConfigured({ setting: "KV (KV namespace binding)" }));
      return KeyValue.of({ get: () => missing, set: () => missing, remove: () => missing });
    }),
  );
}

export const cached = <A, I, E, R>(
  key: string,
  schema: Schema.Codec<A, I>,
  ttlSeconds: number,
  compute: Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const kv = yield* KeyValue;
    const hit = yield* kv.get(key, schema);
    if (Option.isSome(hit)) return hit.value;
    const value = yield* compute;
    yield* kv.set(key, schema, value, ttlSeconds);
    return value;
  });
