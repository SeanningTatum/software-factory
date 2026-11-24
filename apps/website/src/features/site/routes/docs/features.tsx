import { createFileRoute } from "@tanstack/react-router";
import { Code, H1, H2, List, P } from "#/features/site/components/doc.tsx";
import { coreFeatures, features } from "#/features/site/lib/features.ts";

export const Route = createFileRoute("/docs/features")({
  head: () => ({ meta: [{ title: "Features · tanstack-cf-saas" }] }),
  component: Features,
});

function Features() {
  return (
    <>
      <H1>Features</H1>
      <P>
        A feature is one folder, <code>src/features/&lt;name&gt;/</code>, and it owns nothing
        outside it. The kernel, the code every feature runs on, lives in <code>src/app/</code>.
      </P>
      <Code>
        {`src/
  app/              the kernel: runtime, request, env, errors, middleware
  features/<name>/  one feature
  gen/              written by blocks:sync; never edit
  routes/__root.tsx the only route outside a feature`}
      </Code>
      <H2>Inside a feature</H2>
      <P>A lint rule allows only these names. Make only the folders a feature needs.</P>
      <List
        items={[
          <>
            <code>api/</code>: server functions and services.
          </>,
          <>
            <code>routes/</code>: pages and server routes, served from the URL root, so{" "}
            <code>auth/routes/login.tsx</code> is <code>/login</code>.
          </>,
          <>
            <code>components/</code>: React, with the machines that drive it.
          </>,
          <>
            <code>machines/</code>: lifecycle machines. <code>lib/</code>: pure helpers.{" "}
            <code>e2e/</code>: Playwright specs.
          </>,
          <>
            <code>feature.json</code>: name, what it requires, its bindings, vars and secrets.
          </>,
          <>
            <code>layer.ts</code>, <code>errors.ts</code>, <code>events.ts</code>,{" "}
            <code>nav.ts</code> and a few more: what the feature adds to the shared wiring.
          </>,
        ]}
      />
      <P>
        <code>bun run blocks:sync</code> builds the shared wiring from them: the runtime's layers,
        the error map, the event catalog, the nav, the route tree, wrangler bindings and{" "}
        <code>.dev.vars.example</code>.
      </P>
      <H2>FEATURES.md and TIMELINE.md</H2>
      <P>
        <code>FEATURES.md</code> lists every feature in one line. Each feature's{" "}
        <code>TIMELINE.md</code> starts with a block that sync writes (what the feature is, what it
        depends on, its routes, services, errors and events), then the diagram of each machine, then
        Decisions and History that people write, one dated line each. Read both before you change a
        feature.
      </P>
      <P>
        On pull requests, CI runs the timeline gate: a change to a feature needs a new line in its
        timeline. The <code>no-timeline</code> label skips it for a trivial change.
      </P>
      <Code>{"bunx cf-saas-lint timeline --base origin/main"}</Code>
      <H2>Add and remove</H2>
      <P>
        {coreFeatures.join(", ")} are core: every project has them and they can't be removed. The
        rest come and go:
      </P>
      <Code>
        {
          "bunx create-tanstack-cf-saas add kv\nbunx create-tanstack-cf-saas remove kv\nbun run blocks:check"
        }
      </Code>
      {features.map((feature) => (
        <section key={feature.name}>
          <H2>
            {feature.title}{" "}
            <code className="text-sm font-normal text-muted-foreground">{feature.name}</code>
          </H2>
          <P>
            {feature.summary}
            {feature.requires.length > 0 && ` Needs ${feature.requires.join(", ")}.`}
          </P>
          <List items={feature.brings} />
        </section>
      ))}
    </>
  );
}
