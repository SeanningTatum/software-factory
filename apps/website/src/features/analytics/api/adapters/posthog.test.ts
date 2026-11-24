import { Effect, Exit } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { posthogAdapter } from "./posthog.ts";

const batch = [
  {
    event: { _tag: "page_viewed" as const, path: "/x" },
    distinctId: "u1",
    timestamp: "2026-01-01T00:00:00Z",
  },
];

afterEach(() => vi.unstubAllGlobals());

describe("posthogAdapter", () => {
  it("posts the batch with the event name and properties", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await Effect.runPromise(posthogAdapter("phc_key", "https://ph.example/").send(batch));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ph.example/batch/");
    expect(JSON.parse(String(init.body))).toMatchObject({
      api_key: "phc_key",
      batch: [{ event: "page_viewed", distinct_id: "u1", properties: { path: "/x" } }],
    });
  });

  it("fails with a delivery error on a bad status", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 500 }));
    const exit = await Effect.runPromiseExit(posthogAdapter("k", "https://ph.example").send(batch));
    expect(Exit.isFailure(exit)).toBe(true);
  });
});
