import { createFileRoute } from "@tanstack/react-router";
import { Code, H1, H2, List, P } from "#/features/site/components/doc.tsx";
import { features, requiredFeatures, requiredModules } from "#/features/site/lib/features.ts";

export const Route = createFileRoute("/docs/features")({
  head: () => ({ meta: [{ title: "Features · tanstack-cf-saas" }] }),
  component: Features,
});

function Features() {
  return (
    <>
      <H1>Features</H1>
      <P>
        Each part of a project is one folder that owns nothing outside it. Core holds shared modules
        of one kind: components only, or services and helpers only. A module with both, or with a
        page, is a feature. Your own product features go beside <code>auth</code> and{" "}
        <code>billing</code>. The kernel, the code everything runs on, lives in{" "}
        <code>src/app/</code>.
      </P>
      <Code>
        {`src/
  app/                the kernel: runtime, request, env, errors, middleware
  features/
    core/<name>/      a core module: db, kv, observability, analytics, ui
    core/lib/         shared pure helpers
    <name>/           a feature: consent, home, auth, billing, uploads, workflows, yours
  gen/                written by blocks:sync; never edit
  routes/__root.tsx   the only route outside a feature`}
      </Code>
      <H2>Core modules</H2>
      <P>
        A core module is something other features build on, with no pages. The layout lint holds
        each one to a single kind:
      </P>
      <List
        items={[
          <>
            Components only, like <code>ui</code>: <code>components/</code> and <code>lib/</code>,
            no services, routes or machines.
          </>,
          <>
            Services and helpers only, like <code>db</code>, <code>kv</code>,{" "}
            <code>observability</code> and <code>analytics</code>: <code>api/</code>,{" "}
            <code>lib/</code>, <code>machines/</code> and server routes under{" "}
            <code>routes/api/</code>, no components.
          </>,
          <>
            <code>core/lib/</code>: pure helpers that two or more features use, such as{" "}
            <code>outsideCall</code>. Effect functions are fine; services, layers and React are not.
          </>,
        ]}
      />
      <P>
        Nothing in core imports a feature outside it. Names stay flat and unique, so{" "}
        <code>--features db,kv</code> and <code>remove kv</code> work wherever a module lives.
      </P>
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
        <code>FEATURES.md</code> lists every core module and feature in one line. Each one's{" "}
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
        Every project has the core modules {requiredModules.join(", ")} and the features{" "}
        {requiredFeatures.join(", ")}; they can't be removed. The rest come and go, in core or not:
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
            {feature.core && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">core module</span>
            )}
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
