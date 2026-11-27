import { Schema } from "effect";
import { featureEvents } from "#/gen/events.ts";

export const catalog = featureEvents;
export const AnalyticsEvent = Schema.Union(catalog);
export type AnalyticsEvent = typeof AnalyticsEvent.Type;
