import { Effect, Layer, Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { type AppEnv, CloudflareEnv } from "#/app/env.ts";
import { cached, KeyValue } from "./key-value.ts";
import { memoryNamespace } from "./memory-namespace.ts";

const Prefs = Schema.Struct({ theme: Schema.Literals(["light", "dark"]) });

const run = <A, E>(effect: Effect.Effect<A, E, KeyValue>, kv = memoryNamespace().kv) =>
  Effect.runPromise(
    effect.pipe(Effect.provide(Layer.succeed(KeyValue)(KeyValue.fromNamespace(kv)))),
  );

describe("KeyValue", () => {
  it("round-trips a value through its schema", async () => {
    const { kv, store } = memoryNamespace();
    const value = await run(
      Effect.gen(function* () {
        const keyValue = yield* KeyValue;
        yield* keyValue.set("prefs:u1", Prefs, { theme: "dark" }, 10);
        return yield* keyValue.get("prefs:u1", Prefs);
      }),
      kv,
    );
    expect(value).toEqual(Option.some({ theme: "dark" }));
    expect(store.get("prefs:u1")?.ttl).toBe(60);
  });

  it("treats a value that no longer matches the schema as missing", async () => {
    const { kv } = memoryNamespace();
    await kv.put("prefs:u1", '{"theme":"blue"}');
    const value = await run(
      Effect.gen(function* () {
        const keyValue = yield* KeyValue;
        return yield* keyValue.get("prefs:u1", Prefs);
      }),
      kv,
    );
    expect(Option.isNone(value)).toBe(true);
  });

  it("builds without a binding; each call then fails with NotConfigured", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const keyValue = yield* KeyValue;
        return yield* keyValue.get("k", Prefs);
      }).pipe(
        Effect.provide(KeyValue.layer.pipe(Layer.provide(CloudflareEnv.layer({} as AppEnv)))),
      ),
    );
    expect(JSON.stringify(exit)).toContain("NotConfigured");
  });
});

describe("cached", () => {
  it("computes once and serves the stored value after", async () => {
    const { kv } = memoryNamespace();
    let computed = 0;
    const lookup = cached(
      "answer",
      Schema.Number,
      300,
      Effect.sync(() => ++computed * 42),
    );
    expect(await run(lookup, kv)).toBe(42);
    expect(await run(lookup, kv)).toBe(42);
    expect(computed).toBe(1);
  });
});
