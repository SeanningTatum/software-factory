import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { type AppEnv, CloudflareEnv } from "#/app/env.ts";
import { CurrentRequest, requestInfoFrom } from "#/app/request.ts";
import type { AnalyticsAdapter, Captured } from "./adapter.ts";
import { Analytics, selectAdapter } from "./analytics.ts";

const env = (vars: Record<string, string>) => vars as unknown as AppEnv;

describe("selectAdapter", () => {
  it.each([
    [{}, "console"],
    [{ ANALYTICS_PROVIDER: "none" }, "none"],
    [{ ANALYTICS_PROVIDER: "posthog" }, "none"],
    [{ ANALYTICS_PROVIDER: "posthog", POSTHOG_KEY: "phc" }, "posthog"],
    [{ ANALYTICS_PROVIDER: "analytics-engine" }, "none"],
    [{ ANALYTICS_PROVIDER: "something-else" }, "none"],
  ])("%o gives %s", (vars, name) => {
    expect(selectAdapter(env(vars)).name).toBe(name);
  });
});

describe("Analytics", () => {
  const run = (adapter: AnalyticsAdapter, userId?: string) => {
    const info = requestInfoFrom(new Request("https://x.dev/"));
    info.userId = userId;
    const layer = Analytics.layerWith(() => adapter).pipe(
      Layer.provide(Layer.mergeAll(CloudflareEnv.layer(env({})), CurrentRequest.layer(info))),
    );
    return Effect.gen(function* () {
      const analytics = yield* Analytics;
      yield* analytics.capture({ _tag: "page_viewed", path: "/a" });
      yield* analytics.capture({ _tag: "page_viewed", path: "/b" }, "someone");
    }).pipe(Effect.provide(layer), Effect.runPromise);
  };

  it("sends one batch when the request ends, with the user as distinct id", async () => {
    const sent: Array<ReadonlyArray<Captured>> = [];
    await run(
      { name: "test", send: (batch) => Effect.sync(() => void sent.push(batch)) },
      "user_1",
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]?.map((c) => c.distinctId)).toEqual(["user_1", "someone"]);
  });

  it("never fails the request when delivery fails", async () => {
    await expect(
      run({
        name: "failing",
        send: () => Effect.fail({ _tag: "AnalyticsDeliveryError" } as never),
      }),
    ).resolves.toBeUndefined();
  });
});
