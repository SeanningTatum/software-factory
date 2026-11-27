import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
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
  // The theme script is inline: without the nonce the production CSP blocks it.
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <RootProvider theme={{ nonce }}>
      <DocsLayout nav={{ enabled: false, title: "Docs" }} tree={data.pageTree}>
        <DocsContent path={data.path} />
      </DocsLayout>
    </RootProvider>
  );
}
