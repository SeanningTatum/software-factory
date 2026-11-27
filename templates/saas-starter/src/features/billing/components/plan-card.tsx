import { useMachine } from "@xstate/react";
import { fromPromise } from "xstate";
import { Button } from "#/features/core/ui/components/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/features/core/ui/components/card.tsx";
import type { BillingState } from "../api/billing-service.ts";
import { billingClient } from "../lib/billing-client.ts";
import { type CheckoutAction, checkoutMachine } from "./checkout.machine.ts";
import { PlanActions } from "./plan-actions.tsx";

const redirect = async (action: CheckoutAction) => {
  const base = window.location.origin;
  const result =
    action.kind === "upgrade"
      ? await billingClient.subscription.upgrade({
          plan: action.plan,
          successUrl: `${base}/billing?checkout=success`,
          cancelUrl: `${base}/billing`,
        })
      : await billingClient.subscription.billingPortal({ returnUrl: `${base}/billing` });
  if (result.error)
    return Promise.reject(new Error(result.error.message ?? "Stripe is unavailable"));
};

const summary = (state: BillingState) => {
  if (state.status === "past_due" || state.status === "unpaid")
    return "Your last payment failed. Update your card to keep access.";
  if (state.cancelAtPeriodEnd) return "Your subscription ends at the close of this period.";
  return state.entitled ? "Thanks for subscribing." : "Upgrade when you're ready.";
};

export function PlanCard({ state }: { state: BillingState }) {
  const [snapshot, send] = useMachine(
    checkoutMachine.provide({ actors: { redirect: fromPromise(({ input }) => redirect(input)) } }),
  );
  const busy = snapshot.matches("redirecting") || snapshot.status === "done";
  const retry = () => send({ type: "RETRY" });
  const dismiss = () => send({ type: "DISMISS" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your plan: {state.entitled ? state.plan : "Free"}</CardTitle>
        <CardDescription>{summary(state)}</CardDescription>
      </CardHeader>
      {!state.configured && (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Billing isn't set up yet. Run <code>bun run setup</code> to add your Stripe keys.
          </p>
        </CardContent>
      )}
      {snapshot.context.error && (
        <CardContent>
          <p role="alert" className="text-sm text-destructive">
            {snapshot.context.error}
          </p>
        </CardContent>
      )}
      <CardFooter className="gap-2">
        {snapshot.matches("failed") ? (
          <>
            <Button onClick={retry}>Try again</Button>
            <Button variant="ghost" onClick={dismiss}>
              Cancel
            </Button>
          </>
        ) : (
          <PlanActions state={state} busy={busy} send={send} />
        )}
      </CardFooter>
    </Card>
  );
}
