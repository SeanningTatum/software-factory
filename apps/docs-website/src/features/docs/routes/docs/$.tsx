import { createFileRoute, notFound } from "@tanstack/react-router";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { Wordmark } from "#/features/core/ui/components/wordmark.tsx";
import { loadDocsPage } from "#/features/docs/api/loaders.ts";
import { DocsContent } from "#/features/docs/components/docs-content.tsx";
import { docs } from "#/features/docs/lib/source.ts";

export const Route = createFileRoute("/docs/$")({
  component: DocsRoute,
  loader: async ({ params }) => {
    const data = await loadDocsPage({ data: params._splat?.split("/").filter(Boolean) ?? [] });
    if (!data) throw notFound();
    await docs.getPage(data.path)?.preload();
    return data;
  },
});

function DocsRoute() {
  const data = useFumadocsLoader(Route.useLoaderData());
  return (
    <DocsLayout nav={{ title: <Wordmark /> }} tree={data.pageTree}>
      <DocsContent path={data.path} />
    </DocsLayout>
  );
}
