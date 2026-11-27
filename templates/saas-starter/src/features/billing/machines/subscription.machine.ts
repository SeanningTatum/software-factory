import { getNextSnapshot, setup } from "xstate";

export type Status =
  | "none"
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled";

type Event = { type: `TO_${Uppercase<Exclude<Status, "none">>}` };

export const subscriptionMachine = setup({ types: { events: {} as Event } }).createMachine({
  id: "subscription",
  initial: "none",
  states: {
    none: { on: { TO_INCOMPLETE: "incomplete", TO_TRIALING: "trialing", TO_ACTIVE: "active" } },
    incomplete: { on: { TO_ACTIVE: "active", TO_TRIALING: "trialing", TO_CANCELED: "canceled" } },
    trialing: { on: { TO_ACTIVE: "active", TO_PAST_DUE: "past_due", TO_CANCELED: "canceled" } },
    active: { on: { TO_PAST_DUE: "past_due", TO_CANCELED: "canceled" } },
    past_due: { on: { TO_ACTIVE: "active", TO_UNPAID: "unpaid", TO_CANCELED: "canceled" } },
    unpaid: { on: { TO_ACTIVE: "active", TO_CANCELED: "canceled" } },
    canceled: { type: "final" },
  },
});

const STATUSES = new Set<string>([
  "none",
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "canceled",
]);

export const isStatus = (value: string): value is Status => STATUSES.has(value);

export const isExpectedChange = (from: Status, to: Status): boolean => {
  if (from === to) return true;
  if (to === "none") return false;
  const snapshot = subscriptionMachine.resolveState({ value: from });
  const event = { type: `TO_${to.toUpperCase()}` } as Event;
  return getNextSnapshot(subscriptionMachine, snapshot, event).value === to;
};

export const isEntitled = (status: Status) => status === "active" || status === "trialing";
