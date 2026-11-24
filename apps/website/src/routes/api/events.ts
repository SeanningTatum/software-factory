import { createFileRoute } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { Analytics } from "#/core/analytics/analytics.ts";
import { BrowserEvent } from "#/core/analytics/events.ts";
import { readBody } from "#/core/body.ts";
import { InvalidInput } from "#/core/errors.ts";
import { runResponse } from "#/core/run-effect.ts";

const MAX_BYTES = 16 * 1024;
const MAX_EVENTS = 20;
const NO_CONTENT = 204;

const Payload = Schema.Struct({
  events: Schema.Array(BrowserEvent).check(Schema.isMaxLength(MAX_EVENTS)),
});

/** First-party ingest for browser events: size-capped, Schema-checked, sent with the request's batch. */
export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      POST: ({ request, context }) =>
        runResponse(
          context,
          Effect.gen(function* () {
            const body = yield* readBody(request, MAX_BYTES);
            const payload = yield* Schema.decodeUnknownEffect(Payload)(body).pipe(
              Effect.mapError((issue) => new InvalidInput({ issues: String(issue) })),
            );
            const analytics = yield* Analytics;
            yield* Effect.forEach(payload.events, (event) => analytics.capture(event));
            return new Response(null, { status: NO_CONTENT });
          }),
          "events.ingest",
        ),
    },
  },
});
