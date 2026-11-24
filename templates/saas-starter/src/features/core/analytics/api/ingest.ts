import { Effect, Schema } from "effect";
import { readBody } from "#/app/body.ts";
import { CloudflareEnv } from "#/app/env.ts";
import { InvalidInput } from "#/app/errors.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { checkLimit, clientAddress, type Limiter } from "#/features/core/lib/rate-limit.ts";
import { BrowserEvent } from "../events.ts";
import { browserDistinctId } from "../lib/browser.ts";
import { Analytics } from "./analytics.ts";

const MAX_BYTES = 16 * 1024;
const MAX_EVENTS = 20;

const Payload = Schema.Struct({
  events: Schema.Array(BrowserEvent).check(Schema.isMaxLength(MAX_EVENTS)),
});

/**
 * Takes a batch of browser events: rate-limited per address, size-capped, Schema-checked, and
 * attributed to the signed-in user or the visitor's consented anonymous id. `userId` is only
 * looked up once the request has passed the limit.
 */
export const ingestBrowserEvents = Effect.fn("Analytics.ingest")(function* (
  request: Request,
  requestId: string,
  userId: Effect.Effect<string | undefined>,
) {
  const env = yield* CloudflareEnv;
  yield* checkLimit(binding<Limiter>(env, "EVENTS_LIMITER"), clientAddress(request.headers));
  const payload = yield* Schema.decodeUnknownEffect(Payload)(
    yield* readBody(request, MAX_BYTES),
  ).pipe(Effect.mapError((issue) => new InvalidInput({ issues: String(issue) })));
  const distinctId = browserDistinctId(yield* userId, request.headers.get("cookie"), requestId);
  const analytics = yield* Analytics;
  yield* Effect.forEach(payload.events, (event) => analytics.capture(event, distinctId), {
    discard: true,
  });
});
