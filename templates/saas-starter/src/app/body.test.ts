import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { readBody, readForm } from "./body.ts";

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("https://x.dev/", { method: "POST", body, headers });

/** A body with no content-length, as a chunked upload sends it; counts how much was pulled. */
const chunked = (chunks: number, chunkBytes: number) => {
  const state = { pulled: 0 };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (state.pulled >= chunks) return controller.close();
      state.pulled++;
      controller.enqueue(new Uint8Array(chunkBytes).fill(32));
    },
  });
  const request = new Request("https://x.dev/", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  return { request, state };
};

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

  it("stops reading a chunked body once it passes the limit", async () => {
    const { request, state } = chunked(50, 1024 * 1024);
    expect(request.headers.get("content-length")).toBeNull();
    const exit = await Effect.runPromiseExit(readBody(request, 16 * 1024));
    expect(JSON.stringify(exit)).toContain("body over 16384 bytes");
    expect(state.pulled).toBeLessThanOrEqual(2);
  });
});

describe("readForm", () => {
  it("reads a multipart form under the limit", async () => {
    const form = new FormData();
    form.set("file", new File(["hello"], "a.txt", { type: "text/plain" }));
    const parsed = await Effect.runPromise(readForm(post(form), 10_000));
    expect(await (parsed.get("file") as File).text()).toBe("hello");
  });

  it("stops reading a chunked form once it passes the limit", async () => {
    const { request, state } = chunked(50, 1024 * 1024);
    const exit = await Effect.runPromiseExit(readForm(request, 1024 * 1024));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(state.pulled).toBeLessThanOrEqual(3);
  });
});
