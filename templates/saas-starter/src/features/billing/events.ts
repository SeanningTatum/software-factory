import { Schema } from "effect";

const Plan = Schema.String.check(Schema.isMaxLength(64));

const CheckoutStarted = Schema.TaggedStruct("checkout_started", { plan: Plan });
const SubscriptionActivated = Schema.TaggedStruct("subscription_activated", { plan: Plan });
const SubscriptionCanceled = Schema.TaggedStruct("subscription_canceled", { plan: Plan });

export const events = [CheckoutStarted, SubscriptionActivated, SubscriptionCanceled] as const;

/** What success looks like for this feature, and the catalog events that measure it. */
export const metric = {
  name: "Checkouts that become paid subscriptions, less cancellations",
  events: ["checkout_started", "subscription_activated", "subscription_canceled"],
} as const;
