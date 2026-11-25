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

/** An IPv6 address cut to its first 64 bits (one customer's whole network); IPv4 is unchanged. */
const network = (address: string) => {
  if (!address.includes(":") || address.includes(".")) return address;
  const [head = "", tail = ""] = address.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = address.includes("::")
    ? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    : left;
  return `${groups
    .slice(0, 4)
    .map((group) => Number.parseInt(group, 16).toString(16))
    .join(":")}::/64`;
};

/**
 * The client's address as Cloudflare saw it (an IPv6 one as its /64); only "unknown" outside
 * Cloudflare (tests, local dev).
 */
export const clientAddress = (headers: Headers) => {
  const address = headers.get("cf-connecting-ip");
  return address ? network(address) : "unknown";
};
