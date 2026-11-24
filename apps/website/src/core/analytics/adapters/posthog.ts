import { Effect } from "effect";
import { type AnalyticsAdapter, AnalyticsDeliveryError, properties } from "../adapter.ts";

/** Sends a batch to PostHog's /batch/ endpoint over fetch; no SDK, so nothing joins the bundle. */
export const posthogAdapter = (apiKey: string, host: string): AnalyticsAdapter => ({
  name: "posthog",
  send: Effect.fn("Analytics.posthog.send")(function* (batch) {
    const body = JSON.stringify({
      api_key: apiKey,
      batch: batch.map(({ event, distinctId, timestamp }) => ({
        event: event._tag,
        distinct_id: distinctId,
        timestamp,
        properties: properties(event),
      })),
    });
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${host.replace(/\/$/, "")}/batch/`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        }),
      catch: (cause) => new AnalyticsDeliveryError({ provider: "posthog", cause }),
    });
    if (!response.ok) {
      return yield* new AnalyticsDeliveryError({
        provider: "posthog",
        cause: new Error(`HTTP ${response.status}`),
      });
    }
  }),
});
