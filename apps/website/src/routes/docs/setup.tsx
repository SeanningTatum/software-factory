import { createFileRoute } from "@tanstack/react-router";
import { Code, H1, H2, P } from "#/site/doc.tsx";

export const Route = createFileRoute("/docs/setup")({
  head: () => ({ meta: [{ title: "Deploying · tanstack-cf-saas" }] }),
  component: Setup,
});

function Setup() {
  return (
    <>
      <H1>Deploying</H1>
      <P>
        <code>setup</code> creates what your blocks need on Cloudflare, for production and staging,
        records the ids in
        <code> wrangler.jsonc</code>, and sets secrets. Run it again whenever you like: it finds
        what exists and only adds what is missing.
      </P>
      <Code>
        {
          "npx wrangler login\nbunx create-tanstack-cf-saas setup --var APP_URL=https://app.example.com"
        }
      </Code>
      <H2>Secrets</H2>
      <P>
        Secrets reach Wrangler on standard input, never as arguments or in files. Set them as
        environment variables to skip the prompts, which also lets an agent or a CI job run setup
        unattended:
      </P>
      <Code>
        {
          "STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... \\\n  bunx create-tanstack-cf-saas setup --yes"
        }
      </Code>
      <H2>What is still missing</H2>
      <P>
        <code>--check</code> prints every setting by name, never by value, with the command that
        fixes each. It exits non-zero while anything required is missing, so it works as a deploy
        gate.
      </P>
      <Code>{"bunx create-tanstack-cf-saas setup --check"}</Code>
      <H2>Pipelines</H2>
      <P>
        Every project ships with <code>.github/workflows/deploy.yml</code>: staging on each push to
        main, then production once someone approves the <code>production</code> environment, each
        followed by a health check. A failed production check rolls back.
      </P>
    </>
  );
}
