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

  it("puts the Worker's version on each event", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await Effect.runPromise(posthogAdapter("k", "https://ph.example", "v1.2.0").send(batch));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).batch[0].properties).toEqual({
      path: "/x",
      app_version: "v1.2.0",
    });
    const identify = {
      ...batch[0],
      event: { _tag: "user_identified" as const, anonId: "anon:a1" },
    };
    await Effect.runPromise(posthogAdapter("k", "https://ph.example", "v1.2.0").send([identify]));
    const [, sent] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse(String(sent.body)).batch[0].properties.app_version).toBe("v1.2.0");
  });

  it("sends user_identified as PostHog's $identify, linking the anonymous id", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const identify = {
      event: { _tag: "user_identified" as const, anonId: "anon:a1" },
      distinctId: "u1",
      timestamp: "2026-01-01T00:00:00Z",
    };
    await Effect.runPromise(posthogAdapter("k", "https://ph.example").send([identify]));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).batch).toEqual([
      {
        event: "$identify",
        distinct_id: "u1",
        timestamp: "2026-01-01T00:00:00Z",
        properties: { $anon_distinct_id: "anon:a1" },
      },
    ]);
  });

  it("fails with a delivery error on a bad status", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 500 }));
    const exit = await Effect.runPromiseExit(posthogAdapter("k", "https://ph.example").send(batch));
    expect(Exit.isFailure(exit)).toBe(true);
  });
});
