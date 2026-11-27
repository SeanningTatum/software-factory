import { Effect, Tracer } from "effect";
import { describe, expect, it } from "vitest";
import { outsideCall } from "./call.ts";

class Boom {
  readonly _tag = "Boom";
  constructor(readonly cause: unknown) {}
}

describe("outsideCall", () => {
  it("succeeds with what the promise resolves to", async () => {
    const value = await Effect.runPromise(
      outsideCall(
        "test.ok",
        () => Promise.resolve(42),
        (cause) => new Boom(cause),
      ),
    );
    expect(value).toBe(42);
  });

  it("turns a rejection into the error onError builds", async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        outsideCall(
          "test.fail",
          () => Promise.reject(new Error("down")),
          (c) => new Boom(c),
        ),
      ),
    );
    expect(error).toEqual(new Boom(new Error("down")));
  });

  it("runs the call in a client span with the given name and attributes", async () => {
    const spans: Array<Tracer.NativeSpan> = [];
    const tracer = Tracer.make({
      span: (options) => {
        const span = new Tracer.NativeSpan(options);
        spans.push(span);
        return span;
      },
    });
    await Effect.runPromise(
      outsideCall(
        "kv.get",
        () => Promise.resolve(null),
        (c) => new Boom(c),
        { key: "a" },
      ).pipe(Effect.withTracer(tracer)),
    );
    expect(spans.map((s) => [s.name, s.kind, s.attributes.get("key")])).toEqual([
      ["kv.get", "client", "a"],
    ]);
  });
});
