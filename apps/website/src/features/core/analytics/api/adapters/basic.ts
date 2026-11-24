import { Effect } from "effect";
import { type AnalyticsAdapter, properties } from "../adapter.ts";

export const noopAdapter: AnalyticsAdapter = { name: "none", send: () => Effect.void };

export const consoleAdapter: AnalyticsAdapter = {
  name: "console",
  send: (batch) =>
    Effect.forEach(batch, ({ event, distinctId }) =>
      Effect.logInfo("analytics").pipe(
        Effect.annotateLogs({ event: event._tag, distinctId, properties: properties(event) }),
      ),
    ).pipe(Effect.asVoid),
};
