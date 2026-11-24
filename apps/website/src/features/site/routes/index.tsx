import { createFileRoute, Link } from "@tanstack/react-router";
import { CopyCommand } from "#/features/site/components/copy-command.tsx";
import { CREATE_COMMAND, coreFeatures, features } from "#/features/site/lib/features.ts";
import { buttonVariants } from "#/features/ui/components/button.tsx";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "tanstack-cf-saas: a SaaS on Cloudflare Workers, one feature at a time" },
      {
        name: "description",
        content:
          "TanStack Start on Cloudflare Workers, written in Effect, with every flow drawn as a state machine.",
      },
    ],
  }),
  component: Landing,
});

const promises = [
  {
    title: "Effect on the server",
    body: "Services, typed errors and Schema checks everywhere. Lint rules ban throw, try/catch and process.env outside the edges.",
  },
  {
    title: "A machine for every flow",
    body: "Sign-in, checkout, uploads and subscriptions are XState machines. A test checks each one and keeps its diagram current.",
  },
  {
    title: "Ready for production",
    body: "One request id on every log line and span, error reports, a typed analytics catalog with consent, and a nonce CSP.",
  },
  {
    title: "One folder per feature",
    body: "Each feature keeps its code, pages, tests and notes in one folder. Add or remove one and the wiring is rebuilt; CI builds every mix.",
  },
];

function Landing() {
  return (
    <main>
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-24">
        <p className="text-sm font-medium text-muted-foreground">
          TanStack Start · Cloudflare Workers · Effect · XState
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Start your SaaS with the features you need and none you will delete later.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Pick features. The CLI copies them in, wires them up, and sets up D1, KV, R2 and your
          secrets on Cloudflare.
        </p>
        <div className="mt-8 max-w-xl">
          <CopyCommand command={CREATE_COMMAND} />
        </div>
        <div className="mt-6 flex gap-3">
          <Link to="/docs" className={buttonVariants({ size: "lg" })}>
            Read the docs
          </Link>
          <Link to="/signup" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Try the demo
          </Link>
        </div>
      </section>

      <section className="border-t bg-card/40">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-16 sm:grid-cols-2">
          {promises.map((p) => (
            <div key={p.title}>
              <h2 className="font-semibold">{p.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Features</h2>
        <p className="mt-2 text-muted-foreground">
          {coreFeatures.join(", ")} are always on. Pick any of the rest.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.name} className="rounded-xl border p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{feature.title}</h3>
                <code className="text-xs text-muted-foreground">{feature.name}</code>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{feature.summary}</p>
              {feature.requires.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Needs {feature.requires.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
