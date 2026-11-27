import { Effect, ErrorReporter, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { requestInfoFrom } from "#/app/request.ts";
import { Analytics } from "#/features/core/analytics/api/analytics.ts";
import type { AnalyticsEvent } from "#/features/core/analytics/lib/catalog.ts";
import { LoggerLayer } from "#/features/core/observability/api/log.ts";
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

  it("logs and reports a failed step by name, then fails so Cloudflare retries it", async () => {
    const lines: Array<Record<string, unknown>> = [];
    const reported: Array<unknown> = [];
    const layer = Layer.mergeAll(
      Layer.succeed(Analytics)(
        Analytics.of({ capture: () => Effect.die(new Error("posthog down")) }),
      ),
      LoggerLayer(
        requestInfoFrom(new Request("https://workflow.internal/onboarding/run-1")),
        "Info",
        (_level, line) => void lines.push(line),
      ),
      ErrorReporter.layer([ErrorReporter.make(({ error }) => void reported.push(error))]),
    );
    const steps: Steps = { run: (_name, work) => work(), sleep: async () => undefined };
    await expect(
      runOnboarding({ userId: "u1" }, steps, (effect) =>
        Effect.runPromise(effect.pipe(Effect.provide(layer))),
      ),
    ).rejects.toThrow("posthog down");
    expect(lines).toContainEqual(
      expect.objectContaining({
        level: "Error",
        message: "onboarding step failed",
        step: "welcome",
      }),
    );
    expect(reported).toHaveLength(1);
  });
});
