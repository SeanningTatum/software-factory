import type { BillingState } from "../api/billing-service.ts";
import { type Send, StartButton } from "./start-button.tsx";

export function PlanActions({
  state,
  busy,
  send,
}: {
  state: BillingState;
  busy: boolean;
  send: Send;
}) {
  const disabled = busy || !state.configured;
  if (state.status) {
    return (
      <StartButton
        action={{ kind: "manage" }}
        label="Manage subscription"
        busy={busy}
        disabled={disabled}
        send={send}
      />
    );
  }
  return state.plans.map((plan) => (
    <StartButton
      key={plan.name}
      action={{ kind: "upgrade", plan: plan.name }}
      label={`Upgrade to ${plan.label}`}
      busy={busy}
      disabled={disabled}
      send={send}
    />
  ));
}
