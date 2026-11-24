import { createFileRoute } from "@tanstack/react-router";
import { Code, H1, H2, List, P } from "#/site/doc.tsx";

export const Route = createFileRoute("/docs/")({
  head: () => ({ meta: [{ title: "Getting started · tanstack-cf-saas" }] }),
  component: GettingStarted,
});

function GettingStarted() {
  return (
    <>
      <H1>Getting started</H1>
      <P>Create a project, pick blocks, and run it locally in a couple of minutes.</P>
      <Code>{"bunx create-tanstack-cf-saas my-app"}</Code>
      <P>
        The CLI asks for a name and which blocks you want, then installs packages and generates the
        first migration. To ask nothing, pass everything as flags:
      </P>
      <Code>{"bunx create-tanstack-cf-saas my-app --blocks auth,billing --yes"}</Code>
      <H2>Run it</H2>
      <Code>{"cd my-app\nbun run db:migrate:local\nbun run dev"}</Code>
      <P>
        Local settings live in <code>.dev.vars</code>. The CLI writes one for you with a fresh auth
        secret;
        <code> .dev.vars.example</code> lists every setting and what it is for.
      </P>
      <H2>What you get</H2>
      <List
        items={[
          "A request id on every log line, span, error report and response header.",
          "Errors as typed values, each mapped to a status and a message safe to show.",
          "A typed analytics catalog, a consent banner that honours Do Not Track and GPC, and web vitals.",
          "Security headers with a nonce CSP in production.",
          "GitHub Actions that deploy to staging, wait for your approval, then deploy to production with a smoke test.",
        ]}
      />
    </>
  );
}
