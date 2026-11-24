import { createFileRoute } from "@tanstack/react-router";
import { Code, H1, H2, List, P } from "#/features/site/components/doc.tsx";

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
          "test-map: every source file has the tests the map asks for.",
          "feature-layout: a feature holds only the allowed folders and files.",
        ]}
      />
      <H2>State machines</H2>
      <P>
        Every <code>*.machine.ts</code> must have every state reachable, no state that traps you,
        and an initial state that starts nothing. Machines behind UI also need a browser spec that
        replays their paths. Each feature's <code>TIMELINE.md</code> holds a Mermaid diagram of its
        machines, and the tests fail when one is out of date.
      </P>
      <Code>{"bun run machines:print   # rewrites the diagrams in each TIMELINE.md"}</Code>
      <H2>Features</H2>
      <P>
        <code>blocks:check</code> fails when generated files, <code>FEATURES.md</code> or a
        timeline's generated block are stale, when a file sits outside a feature or the kernel, when
        the kernel or a core feature imports an optional feature, or when a feature imports one it
        doesn't list in <code>requires</code>.
      </P>
      <H2>Timelines</H2>
      <P>
        On pull requests, <code>cf-saas-lint timeline</code> fails when a feature changed with no
        new Decisions or History line in its <code>TIMELINE.md</code>.
      </P>
      <Code>{"bunx cf-saas-lint timeline --base origin/main"}</Code>
    </>
  );
}
