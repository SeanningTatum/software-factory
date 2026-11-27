import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { runResponse } from "#/app/run-effect.ts";
import { currentViewer } from "#/app/viewer.ts";
import { ingestBrowserEvents } from "#/features/core/analytics/api/ingest.ts";

const NO_CONTENT = 204;

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      POST: ({ request, context }) =>
        runResponse(
          context,
          ingestBrowserEvents(
            request,
            context.request.id,
            Effect.map(currentViewer, (viewer) => viewer.userId),
          ).pipe(Effect.as(new Response(null, { status: NO_CONTENT }))),
          "events.ingest",
        ),
    },
  },
});
