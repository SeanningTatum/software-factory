import { Effect } from "effect";
import { outsideCall } from "#/features/core/lib/call.ts";
import { type AnalyticsAdapter, AnalyticsDeliveryError, properties } from "../adapter.ts";

/**
 * Sends a batch to PostHog's /batch/ endpoint over fetch; no SDK, so nothing joins the bundle.
 * `version` goes on every event as `app_version`, so a chart can compare the two versions of a
 * gradual rollout.
 */
export const posthogAdapter = (
  apiKey: string,
  host: string,
  version?: string,
): AnalyticsAdapter => ({
  name: "posthog",
  send: Effect.fn("Analytics.posthog.send")(function* (batch) {
    const release = version ? { app_version: version } : {};
    const body = JSON.stringify({
      api_key: apiKey,
      batch: batch.map(({ event, distinctId, timestamp }) =>
        // PostHog merges the anonymous visitor into the user on its own $identify event.
        event._tag === "user_identified"
          ? {
              event: "$identify",
              distinct_id: distinctId,
              timestamp,
              properties: { $anon_distinct_id: event.anonId, ...release },
            }
          : {
              event: event._tag,
              distinct_id: distinctId,
              timestamp,
              properties: { ...properties(event), ...release },
            },
      ),
    });
    const response = yield* outsideCall(
      "posthog.batch",
      () =>
        fetch(`${host.replace(/\/$/, "")}/batch/`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        }),
      (cause) => new AnalyticsDeliveryError({ provider: "posthog", cause }),
    );
    if (!response.ok) {
      return yield* new AnalyticsDeliveryError({
        provider: "posthog",
        cause: new Error(`HTTP ${response.status}`),
      });
    }
  }),
});
