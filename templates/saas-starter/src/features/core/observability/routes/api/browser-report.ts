import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { runResponse } from "#/app/run-effect.ts";
import { reportBrowserError } from "#/features/core/observability/api/browser-report.ts";

const NO_CONTENT = 204;

/** Errors caught in the browser; see reportBrowserError. */
export const Route = createFileRoute("/api/browser-report")({
  server: {
    handlers: {
      POST: ({ request, context }) =>
        runResponse(
          context,
          reportBrowserError(request).pipe(Effect.as(new Response(null, { status: NO_CONTENT }))),
          "browser.report",
        ),
    },
  },
});
