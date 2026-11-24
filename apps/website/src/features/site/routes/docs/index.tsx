import { createFileRoute } from "@tanstack/react-router";
import { Code, H1, H2, List, P } from "#/features/site/components/doc.tsx";

export const Route = createFileRoute("/docs/")({
  head: () => ({ meta: [{ title: "Getting started · tanstack-cf-saas" }] }),
  component: GettingStarted,
});

function GettingStarted() {
  return (
    <>
      <H1>Getting started</H1>
      <P>Create a project, pick features, and run it on your machine in a few minutes.</P>
      <Code>{"bunx create-tanstack-cf-saas my-app"}</Code>
      <P>
        The CLI asks for a name and which features you want, then installs packages and writes the
        first migration. To answer up front, pass flags:
      </P>
      <Code>{"bunx create-tanstack-cf-saas my-app --features auth,billing --yes"}</Code>
      <P>
        <code>--features</code> takes <code>db</code>, <code>auth</code>, <code>billing</code>,{" "}
        <code>kv</code>, <code>workflows</code> and <code>uploads</code>. Leave it empty for the
        required ones alone.
      </P>
      <H2>Run it</H2>
      <Code>{"cd my-app\nbun run db:migrate:local\nbun run dev"}</Code>
      <P>
        Local settings live in <code>.dev.vars</code>. The CLI writes one for you with a fresh auth
        secret; <code>.dev.vars.example</code> lists every setting and what it is for.
      </P>
      <H2>What you get</H2>
      <List
        items={[
          "A request id on every log line, span, error report and response header.",
          "Errors as typed values, each mapped to a status and a message safe to show.",
          "A typed analytics catalog, a consent banner that honours Do Not Track and GPC, and web vitals.",
          "Security headers with a nonce CSP in production.",
          "GitHub Actions that deploy to staging, wait for your approval, then deploy to production and check it.",
          "FEATURES.md and a TIMELINE.md per feature, so you and your agents know what each part is and why.",
        ]}
      />
    </>
  );
}
