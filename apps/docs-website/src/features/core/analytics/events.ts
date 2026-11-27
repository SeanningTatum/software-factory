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

const UserIdentified = Schema.TaggedStruct("user_identified", {
  anonId: Schema.String.check(Schema.isMaxLength(64)),
});

export const BrowserEvent = Schema.Union([PageViewed, WebVital]);
export type BrowserEvent = typeof BrowserEvent.Type;
export const events = [PageViewed, WebVital, UserIdentified] as const;

export const metric = {
  name: "Visitors who view a page and later sign up, with pages that load fast",
  events: ["page_viewed", "web_vital", "user_identified"],
} as const;
