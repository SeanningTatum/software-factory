import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { Auth } from "#/blocks/auth/auth-service.ts";
import { ensureSignedIn } from "#/blocks/auth/guard.ts";
import { Billing } from "#/blocks/billing/billing-service.ts";
import { PlanCard } from "#/blocks/billing/ui/plan-card.tsx";
import { runEffect } from "#/core/run-effect.ts";

const getBilling = createServerFn({ method: "GET" }).handler(({ context }) =>
  runEffect(
    context,
    Effect.gen(function* () {
      const user = yield* (yield* Auth).requireUser;
      return yield* (yield* Billing).stateFor(user.id);
    }),
    "billing.state",
  ),
);

export const Route = createFileRoute("/(billing)/billing")({
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
