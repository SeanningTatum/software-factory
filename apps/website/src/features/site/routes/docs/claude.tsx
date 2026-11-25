import { createFileRoute } from "@tanstack/react-router";
import { Code, H1, P } from "#/features/site/components/doc.tsx";

export const Route = createFileRoute("/docs/claude")({
  head: () => ({ meta: [{ title: "Claude workflows · tanstack-cf-saas" }] }),
  component: Claude,
});

function Claude() {
  return (
    <>
      <H1>Claude workflows</H1>
      <P>
        New projects get a <code>.claude/</code> folder with shared skills, agents, hooks and
        settings, and a<code> harness.lock.json</code> that records a hash for each file. Your edits
        are yours: check what you changed, and update the rest from a newer CLI.
      </P>
      <Code>
        {"bunx create-tanstack-cf-saas harness check\nbunx create-tanstack-cf-saas harness sync"}
      </Code>
      <P>
        Skip it with <code>--no-claude</code> when you create the project. The project's own rules
        live in
        <code> CLAUDE.md</code> at its root.
      </P>
    </>
  );
}
