import type { Effect } from "effect";
import type { AnalyticsDeliveryError } from "../errors.ts";
import type { AnalyticsEvent } from "../lib/catalog.ts";

export interface Captured {
  readonly event: AnalyticsEvent;
  readonly distinctId: string;
  readonly timestamp: string;
}

export interface AnalyticsAdapter {
  readonly name: string;
  readonly send: (batch: ReadonlyArray<Captured>) => Effect.Effect<void, AnalyticsDeliveryError>;
}

export const properties = (event: AnalyticsEvent): Record<string, unknown> => {
  const { _tag, ...rest } = event as AnalyticsEvent & Record<string, unknown>;
  void _tag;
  return rest;
};
