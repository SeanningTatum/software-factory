import { Schema } from "effect";
import { type FeatureError, featureErrorStatus } from "#/gen/errors.ts";

export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", { what: Schema.String }) {}
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {}) {}
export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {}) {}
export class InvalidInput extends Schema.TaggedError<InvalidInput>()("InvalidInput", {
  issues: Schema.String,
}) {}
export class RateLimited extends Schema.TaggedError<RateLimited>()("RateLimited", {
  retryAfterSeconds: Schema.Number,
}) {}
export class NotConfigured extends Schema.TaggedError<NotConfigured>()("NotConfigured", {
  setting: Schema.String,
}) {}
export class ExternalServiceError extends Schema.TaggedError<ExternalServiceError>()(
  "ExternalServiceError",
  {
    service: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export type CoreError =
  | NotFound
  | Unauthorized
  | Forbidden
  | InvalidInput
  | RateLimited
  | NotConfigured
  | ExternalServiceError;

/** How an error reaches the user: the HTTP status and a message safe to show. */
export interface ErrorInfo {
  readonly status: number;
  readonly message: string;
}

export const coreErrorStatus = {
  NotFound: { status: 404, message: "Not found." },
  Unauthorized: { status: 401, message: "Please sign in." },
  Forbidden: { status: 403, message: "You don't have access to that." },
  InvalidInput: { status: 400, message: "Some of what you sent isn't valid." },
  RateLimited: { status: 429, message: "Too many requests. Try again shortly." },
  NotConfigured: { status: 503, message: "This feature isn't set up yet." },
  ExternalServiceError: { status: 502, message: "A service we depend on failed. Try again." },
} as const satisfies Record<CoreError["_tag"], ErrorInfo>;

/** Every error a request can fail with. Features add theirs through src/gen/errors.ts. */
export type AppError = CoreError | FeatureError;

/** One entry per error tag. The `satisfies` makes a new error without an entry a type error. */
export const errorStatus = { ...coreErrorStatus, ...featureErrorStatus } satisfies Record<
  AppError["_tag"],
  ErrorInfo
>;

export const INTERNAL: ErrorInfo = { status: 500, message: "Something went wrong on our side." };

export const errorInfo = (tag: string): ErrorInfo =>
  (errorStatus as Record<string, ErrorInfo | undefined>)[tag] ?? INTERNAL;
