import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { docs } from "#/features/docs/lib/source.ts";

export function DocsContent({ path }: { path: string }) {
  const page = docs.getPage(path);
  if (!page) return null;
  const Mdx = page.body;
  return (
    <DocsPage toc={page.toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <DocsBody>
        <Mdx components={defaultMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}
