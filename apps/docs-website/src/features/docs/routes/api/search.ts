import { createFileRoute } from "@tanstack/react-router";
import { runResponse } from "#/app/run-effect.ts";
import { searchDocs } from "#/features/docs/api/search.ts";

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: ({ request, context }) => runResponse(context, searchDocs(request), "docs.search"),
    },
  },
});
