import { getNextSnapshot, setup } from "xstate";

/**
 * The workflow runs these steps in this order, and a test checks that it does, so this diagram is
 * always what production runs.
 */
export const onboardingMachine = setup({
  types: { events: {} as { type: "STEP_DONE" } },
}).createMachine({
  id: "onboarding",
  initial: "welcome",
  states: {
    welcome: { on: { STEP_DONE: "wait" } },
    wait: { on: { STEP_DONE: "nudge" } },
    nudge: { on: { STEP_DONE: "done" } },
    done: { type: "final" },
  },
});

export const stepOrder = (): ReadonlyArray<string> => {
  const order: Array<string> = [];
  let snapshot = onboardingMachine.resolveState({ value: "welcome" });
  while (snapshot.status !== "done") {
    order.push(String(snapshot.value));
    snapshot = getNextSnapshot(onboardingMachine, snapshot, { type: "STEP_DONE" });
  }
  return order;
};
