import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-24">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Your SaaS, on the edge.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        TanStack Start on Cloudflare Workers, written in Effect, with every flow drawn as a state
        machine.
      </p>
    </main>
  );
}
