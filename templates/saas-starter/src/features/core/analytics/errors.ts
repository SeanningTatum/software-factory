import { Schema } from "effect";
import type { ErrorInfo } from "#/app/errors.ts";

export class AnalyticsDeliveryError extends Schema.TaggedError<AnalyticsDeliveryError>()(
  "AnalyticsDeliveryError",
  {
    provider: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export type Errors = AnalyticsDeliveryError;

export const errorStatus = {
  AnalyticsDeliveryError: { status: 502, message: "Analytics is unavailable. Try again shortly." },
} as const satisfies Record<Errors["_tag"], ErrorInfo>;
