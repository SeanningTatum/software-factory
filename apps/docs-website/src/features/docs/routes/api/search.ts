import { createFileRoute } from "@tanstack/react-router";
import { createFromSource } from "fumadocs-core/search/server";
import { source } from "#/features/docs/lib/source.ts";

const search = createFromSource(source);

export const Route = createFileRoute("/api/search")({
  server: { handlers: { GET: ({ request }) => search.GET(request) } },
});
