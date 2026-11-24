import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { type AppEnv, CloudflareEnv } from "#/app/env.ts";
import { CurrentRequest, requestInfoFrom } from "#/app/request.ts";
import type { Captured } from "./adapter.ts";
import { Analytics } from "./analytics.ts";
import { ingestBrowserEvents } from "./ingest.ts";

const AID = "0b9c6a4e-6d0e-4c3f-9a51-1f0e2b3c4d5e";
const body = JSON.stringify({ events: [{ _tag: "page_viewed", path: "/" }] });

const run = async (headers: Record<string, string>, userId?: string, allow = true) => {
  const sent: Array<Captured> = [];
  const request = new Request("https://x.dev/api/events", { method: "POST", body, headers });
  const env = { EVENTS_LIMITER: { limit: async () => ({ success: allow }) } } as unknown as AppEnv;
  const layer = Analytics.layerWith(() => ({
    name: "test",
    send: (batch) => Effect.sync(() => void sent.push(...batch)),
  })).pipe(
    Layer.provideMerge(
      Layer.mergeAll(CloudflareEnv.layer(env), CurrentRequest.layer(requestInfoFrom(request))),
    ),
  );
  const exit = await ingestBrowserEvents(request, "req-1", Effect.succeed(userId)).pipe(
    Effect.provide(layer),
    Effect.runPromiseExit,
  );
  return { exit, ids: sent.map((c) => c.distinctId) };
};

describe("ingestBrowserEvents", () => {
  it("attributes a signed-in visitor's events to the user", async () =>
    expect((await run({}, "user-1")).ids).toEqual(["user-1"]));

  it("attributes a signed-out visitor's events to their consented anonymous id", async () =>
    expect((await run({ cookie: `consent=granted; aid=${AID}` })).ids).toEqual([`anon:${AID}`]));

  it("refuses an address over the limit and records nothing", async () => {
    const { exit, ids } = await run({}, undefined, false);
    expect(JSON.stringify(exit)).toContain("RateLimited");
    expect(ids).toEqual([]);
  });
});
