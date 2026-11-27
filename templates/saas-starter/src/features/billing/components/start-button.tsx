import type { ActorRefFrom } from "xstate";
import { Button } from "#/features/core/ui/components/button.tsx";
import type { CheckoutAction, checkoutMachine } from "./checkout.machine.ts";

export type Send = ActorRefFrom<typeof checkoutMachine>["send"];

interface StartProps {
  readonly action: CheckoutAction;
  readonly label: string;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly send: Send;
}

export function StartButton({ action, label, busy, disabled, send }: StartProps) {
  const start = () => send({ type: "START", action });
  return (
    <Button disabled={disabled} onClick={start}>
      {busy ? "Opening Stripe…" : label}
    </Button>
  );
}
