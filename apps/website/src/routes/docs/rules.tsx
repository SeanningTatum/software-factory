import { createFileRoute } from "@tanstack/react-router";
import { Code, H1, H2, List, P } from "#/site/doc.tsx";

export const Route = createFileRoute("/docs/rules")({
  head: () => ({ meta: [{ title: "Rules and checks · tanstack-cf-saas" }] }),
  component: Rules,
});

function Rules() {
  return (
    <>
      <H1>Rules and checks</H1>
      <P>Each rule has a check behind it. If the docs and a check disagree, the check wins.</P>
      <Code>{"bun run check"}</Code>
      <H2>House rules</H2>
      <List
        items={[
          "no-throw, no-try-catch: failures travel in Effect's error channel.",
          "no-run-effect: only the edges run effects; everything else returns one.",
          "no-process-env: Workers read settings from the CloudflareEnv service.",
          "external-call-span: every outside call has a span.",
          "file-size: 400 lines at most.",
          "test-map: every source file has the tests the map requires.",
        ]}
      />
      <H2>State machines</H2>
      <P>
        Every <code>*.machine.ts</code> must have every state reachable, no state that traps you,
        and an initial state that starts nothing. Machines behind UI also need a browser spec that
        replays their paths.
      </P>
      <Code>{"bun run machines:print   # writes docs/machines/*.md as Mermaid diagrams"}</Code>
      <H2>Blocks</H2>
      <P>
        <code>blocks:check</code> fails when generated files are stale, when core imports a block,
        or when a block imports one it doesn't list in <code>requires</code>.
      </P>
    </>
  );
}
