import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { readBody } from "./body.ts";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://x.dev/", { method: "POST", body, headers });

describe("readBody", () => {
  it("parses a small JSON body", async () => {
    await expect(Effect.runPromise(readBody(post('{"a":1}'), 100))).resolves.toEqual({ a: 1 });
  });

  it.each([
    ["too large", post("x".repeat(200)), 100],
    ["declared too large", post("{}", { "content-length": "999" }), 100],
    ["not JSON", post("{nope"), 100],
  ])("rejects a body that is %s", async (_, request, max) => {
    const exit = await Effect.runPromiseExit(readBody(request, max));
    expect(Exit.isFailure(exit)).toBe(true);
  });
});
