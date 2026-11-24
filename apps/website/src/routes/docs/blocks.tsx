import { createFileRoute } from "@tanstack/react-router";
import { blocks } from "#/site/blocks.ts";
import { Code, H1, H2, List, P } from "#/site/doc.tsx";

export const Route = createFileRoute("/docs/blocks")({
  head: () => ({ meta: [{ title: "Blocks · tanstack-cf-saas" }] }),
  component: Blocks,
});

function Blocks() {
  return (
    <>
      <H1>Blocks</H1>
      <P>
        A block owns three places and nothing else: <code>src/blocks/&lt;name&gt;/</code>,{" "}
        <code>src/routes/(&lt;name&gt;)/</code> and <code>e2e/&lt;name&gt;/</code>. What blocks
        share (the runtime, the error map, the event catalog, the nav, wrangler bindings and{" "}
        <code>.dev.vars.example</code>) is generated from each block's <code>block.json</code>.
      </P>
      <Code>
        {
          "bunx create-tanstack-cf-saas add kv\nbunx create-tanstack-cf-saas remove kv\nbun run blocks:check"
        }
      </Code>
      {blocks.map((block) => (
        <section key={block.name}>
          <H2>
            {block.title}{" "}
            <code className="text-sm font-normal text-muted-foreground">{block.name}</code>
          </H2>
          <P>
            {block.summary}
            {block.requires.length > 0 && ` Needs ${block.requires.join(", ")}.`}
          </P>
          <List items={block.brings} />
        </section>
      ))}
    </>
  );
}
