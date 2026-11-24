import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "#/components/ui/button.tsx";
import { blocks, CREATE_COMMAND } from "#/site/blocks.ts";
import { CopyCommand } from "#/site/copy-command.tsx";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "tanstack-cf-saas: a SaaS on Cloudflare Workers, built from blocks" },
      {
        name: "description",
        content:
          "TanStack Start on Cloudflare Workers, written in Effect, with every flow drawn as a state machine.",
      },
    ],
  }),
  component: Home,
});

const promises = [
  {
    title: "Effect on the server",
    body: "Services, typed errors and Schema validation everywhere. Lint rules ban throw, try/catch and process.env outside the edges.",
  },
  {
    title: "A machine for every flow",
    body: "Sign-in, checkout, uploads and subscriptions are XState machines. A gate checks each one; a script draws it.",
  },
  {
    title: "Ready for production",
    body: "One request id on every log line and span, error reports, a typed analytics catalog with consent, and a nonce CSP.",
  },
  {
    title: "Blocks that come apart",
    body: "Each block lives in three folders. Add or remove one and the wiring regenerates; CI builds every combination.",
  },
];

function Home() {
  return (
    <main>
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-24">
        <p className="text-sm font-medium text-muted-foreground">
          TanStack Start · Cloudflare Workers · Effect · XState
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Start your SaaS with the parts you need, and nothing you'll rip out later.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Pick the blocks you want. The CLI copies them in, wires them together, and sets up D1, KV,
          R2 and your secrets on Cloudflare.
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
        <h2 className="text-2xl font-semibold tracking-tight">Blocks</h2>
        <p className="mt-2 text-muted-foreground">
          Core is always on. Everything else is your call.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map((block) => (
            <div key={block.name} className="rounded-xl border p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{block.title}</h3>
                <code className="text-xs text-muted-foreground">{block.name}</code>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{block.summary}</p>
              {block.requires.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Needs {block.requires.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
