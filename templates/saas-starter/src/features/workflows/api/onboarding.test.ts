import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { Analytics } from "#/features/core/analytics/api/analytics.ts";
import type { AnalyticsEvent } from "#/features/core/analytics/lib/catalog.ts";
import { runOnboarding, type Steps } from "./onboarding.ts";

describe("runOnboarding", () => {
  it("runs each step in the machine's order and records start and finish", async () => {
    const calls: Array<string> = [];
    const captured: Array<AnalyticsEvent["_tag"]> = [];
    const steps: Steps = {
      run: async (name, work) => {
        calls.push(`do:${name}`);
        await work();
      },
      sleep: async (name) => void calls.push(`sleep:${name}`),
    };
    const analytics = Layer.succeed(Analytics)(
      Analytics.of({ capture: (event) => Effect.sync(() => void captured.push(event._tag)) }),
    );
    await runOnboarding({ userId: "u1" }, steps, (effect) =>
      Effect.runPromise(effect.pipe(Effect.provide(analytics))),
    );
    expect(calls).toEqual(["do:welcome", "sleep:wait", "do:nudge", "do:complete"]);
    expect(captured).toEqual(["onboarding_started", "onboarding_completed"]);
  });
});
