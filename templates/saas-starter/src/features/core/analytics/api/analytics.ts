import { Context, DateTime, Effect, Layer } from "effect";
import { type AppEnv, CloudflareEnv, setting } from "#/app/env.ts";
import { CurrentRequest } from "#/app/request.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { workerVersion } from "#/features/core/lib/version.ts";
import type { AnalyticsEvent } from "../lib/catalog.ts";
import type { AnalyticsAdapter, Captured } from "./adapter.ts";
import { analyticsEngineAdapter, type DataPointWriter } from "./adapters/analytics-engine.ts";
import { consoleAdapter, noopAdapter } from "./adapters/basic.ts";
import { posthogAdapter } from "./adapters/posthog.ts";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

/** Picks the adapter from ANALYTICS_PROVIDER. A missing key or binding turns analytics off, never the app. */
export const selectAdapter = (env: AppEnv): AnalyticsAdapter => {
  const provider = setting(env, "ANALYTICS_PROVIDER") ?? "console";
  if (provider === "console") return consoleAdapter;
  if (provider === "posthog") {
    const key = setting(env, "POSTHOG_KEY");
    const version = workerVersion(env);
    return key
      ? posthogAdapter(
          key,
          setting(env, "POSTHOG_HOST") ?? DEFAULT_POSTHOG_HOST,
          // The release tag reads better on a chart; an untagged deploy has only its id.
          version?.tag ?? version?.id,
        )
      : noopAdapter;
  }
  const dataset = binding<DataPointWriter>(env, "ANALYTICS");
  if (provider === "analytics-engine" && dataset) return analyticsEngineAdapter(dataset);
  return noopAdapter;
};

export class Analytics extends Context.Service<
  Analytics,
  {
    /** Queues an event; the batch is sent when the request ends. */
    readonly capture: (event: AnalyticsEvent, distinctId?: string) => Effect.Effect<void>;
  }
>()("app/features/analytics/Analytics") {
  static readonly layerWith = (pick: (env: AppEnv) => AnalyticsAdapter) =>
    Layer.effect(
      Analytics,
      Effect.gen(function* () {
        const env = yield* CloudflareEnv;
        const request = yield* CurrentRequest;
        const adapter = pick(env);
        const buffer: Array<Captured> = [];

        yield* Effect.addFinalizer(() =>
          buffer.length === 0
            ? Effect.void
            : adapter.send(buffer.splice(0)).pipe(
                Effect.withSpan("Analytics.flush", { attributes: { provider: adapter.name } }),
                Effect.catch((error) =>
                  Effect.logWarning("analytics delivery failed; events dropped", error),
                ),
              ),
        );

        const capture = Effect.fn("Analytics.capture")(function* (
          event: AnalyticsEvent,
          distinctId?: string,
        ) {
          const now = yield* DateTime.now;
          buffer.push({
            event,
            distinctId: distinctId ?? request.info.userId ?? `anon:${request.info.id}`,
            timestamp: DateTime.formatIso(now),
          });
        });
        return Analytics.of({ capture });
      }),
    );

  static readonly layer = Analytics.layerWith(selectAdapter);
}
