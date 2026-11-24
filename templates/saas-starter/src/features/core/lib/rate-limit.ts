import { Effect } from "effect";
import { RateLimited } from "#/app/errors.ts";

/** The part of a Workers rate-limit binding we use. */
export interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

const WINDOW_SECONDS = 60;

/**
 * Fails with RateLimited when `key` is over the limit. No binding, or a limiter that is down, lets
 * the request through: an outage of the limiter should not lock everyone out.
 */
export const checkLimit = (limiter: Limiter | undefined, key: string) =>
  limiter
    ? Effect.tryPromise(() => limiter.limit({ key })).pipe(
        Effect.withSpan("RateLimit.check"),
        Effect.catch(() => Effect.succeed({ success: true })),
        Effect.flatMap(({ success }) =>
          success
            ? Effect.void
            : Effect.fail(new RateLimited({ retryAfterSeconds: WINDOW_SECONDS })),
        ),
      )
    : Effect.void;

/** The client's address as Cloudflare saw it; only "unknown" outside Cloudflare (tests, local dev). */
export const clientAddress = (headers: Headers) => headers.get("cf-connecting-ip") ?? "unknown";
