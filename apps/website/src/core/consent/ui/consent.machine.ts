import { assign, setup } from "xstate";

export type ConsentChoice = "granted" | "denied";

export interface ConsentInput {
  /** The choice saved in the consent cookie, if any. */
  readonly stored: ConsentChoice | undefined;
  /** Do Not Track or Global Privacy Control is on. */
  readonly optedOut: boolean;
}

/**
 * Whether the browser may send analytics. Server events for signed-in flows don't depend on it.
 *
 * resolving → blocked   when DNT or GPC is on (no banner, no browser events)
 *           → granted / denied from the saved cookie
 *           → asking    on a first visit
 */
export const consentMachine = setup({
  types: {
    context: {} as { stored: ConsentChoice | undefined; optedOut: boolean },
    input: {} as ConsentInput,
    events: {} as { type: "ACCEPT" } | { type: "DECLINE" } | { type: "REOPEN" },
  },
  actions: {
    /** Saves the choice; the component provides the cookie write. */
    persist: (_, _params: { choice: ConsentChoice }) => undefined,
  },
  guards: {
    optedOut: ({ context }) => context.optedOut,
    storedGranted: ({ context }) => context.stored === "granted",
    storedDenied: ({ context }) => context.stored === "denied",
  },
}).createMachine({
  id: "consent",
  context: ({ input }) => ({ stored: input.stored, optedOut: input.optedOut }),
  initial: "resolving",
  states: {
    resolving: {
      always: [
        { guard: "optedOut", target: "blocked" },
        { guard: "storedGranted", target: "granted" },
        { guard: "storedDenied", target: "denied" },
        { target: "asking" },
      ],
    },
    asking: {
      on: {
        ACCEPT: {
          target: "granted",
          actions: [
            assign({ stored: "granted" }),
            { type: "persist", params: { choice: "granted" } },
          ],
        },
        DECLINE: {
          target: "denied",
          actions: [
            assign({ stored: "denied" }),
            { type: "persist", params: { choice: "denied" } },
          ],
        },
      },
    },
    granted: { on: { REOPEN: "asking" } },
    denied: { on: { REOPEN: "asking" } },
    blocked: { type: "final" },
  },
});
