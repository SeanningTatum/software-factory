import { createFileRoute } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { OnboardingParams } from "#/blocks/workflows/onboarding.ts";
import { Onboarding } from "#/blocks/workflows/onboarding-service.ts";
import { requireTriggerToken } from "#/blocks/workflows/trigger-auth.ts";
import { readBody } from "#/core/body.ts";
import { InvalidInput } from "#/core/errors.ts";
import { runResponse } from "#/core/run-effect.ts";

const MAX_BYTES = 1024;
const ACCEPTED = 202;

/** POST starts an onboarding run for a user; GET ?id= reads its status. Both need the trigger token. */
export const Route = createFileRoute("/(workflows)/api/workflows/onboarding")({
  server: {
    handlers: {
      POST: ({ request, context }) =>
        runResponse(
          context,
          Effect.gen(function* () {
            yield* requireTriggerToken(request.headers);
            const params = yield* Schema.decodeUnknownEffect(OnboardingParams)(
              yield* readBody(request, MAX_BYTES),
            ).pipe(Effect.mapError((issue) => new InvalidInput({ issues: String(issue) })));
            const run = yield* (yield* Onboarding).start(params);
            return Response.json(run, { status: ACCEPTED });
          }),
          "workflows.onboarding.start",
        ),
      GET: ({ request, context }) =>
        runResponse(
          context,
          Effect.gen(function* () {
            yield* requireTriggerToken(request.headers);
            const id = new URL(request.url).searchParams.get("id");
            if (!id) return yield* new InvalidInput({ issues: "id is required" });
            return Response.json(yield* (yield* Onboarding).status(id));
          }),
          "workflows.onboarding.status",
        ),
    },
  },
});
