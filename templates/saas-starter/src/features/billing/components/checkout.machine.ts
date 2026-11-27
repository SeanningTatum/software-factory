import { assign, fromPromise, setup } from "xstate";

export type CheckoutAction =
  | { readonly kind: "upgrade"; readonly plan: string }
  | { readonly kind: "manage" };

export const checkoutMachine = setup({
  types: {
    context: {} as { error: string | undefined; last: CheckoutAction | undefined },
    events: {} as
      | { type: "START"; action: CheckoutAction }
      | { type: "RETRY" }
      | { type: "DISMISS" },
  },
  actors: {
    redirect: fromPromise<void, CheckoutAction>(() =>
      Promise.reject(new Error("redirect was not provided")),
    ),
  },
}).createMachine({
  id: "checkout",
  context: { error: undefined, last: undefined },
  initial: "idle",
  states: {
    idle: {
      on: {
        START: { target: "redirecting", actions: assign({ last: ({ event }) => event.action }) },
      },
    },
    redirecting: {
      invoke: {
        src: "redirect",
        input: ({ context }) => context.last as CheckoutAction,
        onDone: "left",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error ? event.error.message : "Stripe is unavailable",
          }),
        },
      },
    },
    failed: {
      on: {
        RETRY: { target: "redirecting", actions: assign({ error: undefined }) },
        DISMISS: { target: "idle", actions: assign({ error: undefined }) },
      },
    },
    left: { type: "final" },
  },
});
