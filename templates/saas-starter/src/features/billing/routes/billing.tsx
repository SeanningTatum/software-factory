import { createFileRoute } from "@tanstack/react-router";
import { ensureSignedIn } from "#/features/auth/api/guard.ts";
import { getBilling } from "#/features/billing/api/loaders.ts";
import { PlanCard } from "#/features/billing/components/plan-card.tsx";

export const Route = createFileRoute("/billing")({
  beforeLoad: ensureSignedIn,
  loader: () => getBilling(),
  component: BillingPage,
});

function BillingPage() {
  const state = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <PlanCard state={state} />
    </main>
  );
}
