import { Schema } from "effect";
import { featureEvents } from "#/gen/events.ts";

/** The whole catalog: every enabled feature's `events.ts`, this one's browser events included. */
export const catalog = featureEvents;
export const AnalyticsEvent = Schema.Union(catalog);
export type AnalyticsEvent = typeof AnalyticsEvent.Type;
