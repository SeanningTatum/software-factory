import { useMachine } from "@xstate/react";
import { fromPromise } from "xstate";
import { Button } from "#/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx";
import { billingClient } from "../billing-client.ts";
import type { BillingState } from "../billing-service.ts";
import { type CheckoutAction, checkoutMachine } from "./checkout.machine.ts";

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
  if (state.status === "past_due")
    return "Your last payment failed. Update your card to keep access.";
  if (state.cancelAtPeriodEnd) return "Your subscription ends at the close of this period.";
  return state.plan === "free" ? "Upgrade when you're ready." : "Thanks for subscribing.";
};

type Send = (event: { type: "START"; action: CheckoutAction }) => void;

function Actions({ state, busy, send }: { state: BillingState; busy: boolean; send: Send }) {
  const disabled = busy || !state.configured;
  if (state.plan !== "free") {
    return (
      <Button
        disabled={disabled}
        onClick={() => send({ type: "START", action: { kind: "manage" } })}
      >
        {busy ? "Opening Stripe…" : "Manage subscription"}
      </Button>
    );
  }
  return state.plans.map((plan) => (
    <Button
      key={plan.name}
      disabled={disabled}
      onClick={() => send({ type: "START", action: { kind: "upgrade", plan: plan.name } })}
    >
      {busy ? "Opening Stripe…" : `Upgrade to ${plan.label}`}
    </Button>
  ));
}

export function PlanCard({ state }: { state: BillingState }) {
  const [snapshot, send] = useMachine(
    checkoutMachine.provide({ actors: { redirect: fromPromise(({ input }) => redirect(input)) } }),
  );
  const busy = snapshot.matches("redirecting") || snapshot.status === "done";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your plan: {state.plan === "free" ? "Free" : state.plan}</CardTitle>
        <CardDescription>{summary(state)}</CardDescription>
      </CardHeader>
      {!state.configured && (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Billing isn't set up yet. Run <code>bunx create-tanstack-cf-saas setup</code> to add
            your Stripe keys.
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
            <Button onClick={() => send({ type: "RETRY" })}>Try again</Button>
            <Button variant="ghost" onClick={() => send({ type: "DISMISS" })}>
              Cancel
            </Button>
          </>
        ) : (
          <Actions state={state} busy={busy} send={send} />
        )}
      </CardFooter>
    </Card>
  );
}
