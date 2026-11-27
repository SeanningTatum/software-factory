import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { runResponse } from "#/app/run-effect.ts";
import { readiness } from "#/features/home/api/health.ts";

const UNAVAILABLE = 503;

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: ({ request, context }) =>
        runResponse(
          context,
          Effect.map(readiness(request.url), (ready) =>
            Response.json(
              { ...ready, requestId: context.request.id },
              ready.ok ? {} : { status: UNAVAILABLE },
            ),
          ),
          "health",
        ),
    },
  },
});
