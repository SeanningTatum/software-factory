import { Schema } from "effect";

const Path = Schema.String.check(Schema.isMaxLength(512));

export const PageViewed = Schema.TaggedStruct("page_viewed", {
  path: Path,
  referrer: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(512))),
});

export const WebVital = Schema.TaggedStruct("web_vital", {
  metric: Schema.Literals(["CLS", "INP", "LCP", "FCP", "TTFB"]),
  value: Schema.Number,
  rating: Schema.Literals(["good", "needs-improvement", "poor"]),
  path: Path,
});

/** Events the browser may send through /api/events. Everything else is captured on the server. */
export const events = [PageViewed, WebVital] as const;
export const BrowserEvent = Schema.Union(events);
export type BrowserEvent = typeof BrowserEvent.Type;
