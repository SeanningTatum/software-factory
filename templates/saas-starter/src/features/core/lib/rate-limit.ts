import { Effect } from "effect";
import { RateLimited } from "#/app/errors.ts";

export interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

const WINDOW_SECONDS = 60;

/**
 * No binding, or a limiter that is down, lets the request through: an outage of the limiter should
 * not lock everyone out.
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

/** A /64 is one customer's whole network. */
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

export const clientAddress = (headers: Headers) => {
  const address = headers.get("cf-connecting-ip");
  return address ? network(address) : "unknown";
};
