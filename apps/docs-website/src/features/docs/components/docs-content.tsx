import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Suspense, use } from "react";
import { docs } from "#/features/docs/lib/source.ts";

export function DocsContent({ path }: { path: string }) {
  const page = docs.getPage(path);
  if (!page) return null;
  const { toc } = use(page.load());
  const Mdx = page.body;
  return (
    <DocsPage toc={toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <DocsBody>
        <Suspense>
          <Mdx components={defaultMdxComponents} />
        </Suspense>
      </DocsBody>
    </DocsPage>
  );
}
