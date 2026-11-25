import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { runEffect } from "#/app/run-effect.ts";
import { Auth } from "#/features/auth/api/auth-service.ts";
import { ensureSignedIn } from "#/features/auth/api/guard.ts";
import { Billing } from "#/features/billing/api/billing-service.ts";
import { PlanCard } from "#/features/billing/components/plan-card.tsx";

const getBilling = createServerFn({ method: "GET" }).handler(({ context }) =>
  runEffect(
    context,
    Effect.gen(function* () {
      const auth = yield* Auth;
      const user = yield* auth.requireUser;
      const billing = yield* Billing;
      return yield* billing.stateFor(user.id);
    }),
    "billing.state",
  ),
);

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
