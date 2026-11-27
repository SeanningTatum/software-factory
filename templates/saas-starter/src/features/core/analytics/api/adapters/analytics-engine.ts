import { Effect } from "effect";
import { type AnalyticsAdapter, AnalyticsDeliveryError, properties } from "../adapter.ts";

export interface DataPointWriter {
  writeDataPoint(point: {
    indexes?: Array<string>;
    blobs?: Array<string>;
    doubles?: Array<number>;
  }): void;
}

export const analyticsEngineAdapter = (dataset: DataPointWriter): AnalyticsAdapter => ({
  name: "analytics-engine",
  send: (batch) =>
    Effect.try({
      try: () => {
        for (const { event, distinctId } of batch) {
          dataset.writeDataPoint({
            indexes: [event._tag],
            blobs: [distinctId, JSON.stringify(properties(event))],
          });
        }
      },
      catch: (cause) => new AnalyticsDeliveryError({ provider: "analytics-engine", cause }),
    }),
});
