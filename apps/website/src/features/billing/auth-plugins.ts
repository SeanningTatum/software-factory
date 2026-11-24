import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { setting } from "#/app/env.ts";
import type { AuthPluginFactory } from "#/features/auth/api/auth.ts";
import { plansFrom } from "./lib/plans.ts";
import { isExpectedChange, isStatus } from "./machines/subscription.machine.ts";

/**
 * Adds Stripe to Better Auth. Without STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET billing stays off
 * and the rest of the app works; /billing explains what is missing.
 */
export const authPlugins: AuthPluginFactory = ({ env, onEvent, onWarning }) => {
  const secretKey = setting(env, "STRIPE_SECRET_KEY");
  const webhookSecret = setting(env, "STRIPE_WEBHOOK_SECRET");
  if (!secretKey || !webhookSecret) return [];
  const stripeClient = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
  return [
    stripe({
      stripeClient,
      stripeWebhookSecret: webhookSecret,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: plansFrom(env).map(({ name, priceId }) => ({ name, priceId })),
        getCheckoutSessionParams: ({ plan }) => {
          onEvent({ _tag: "checkout_started", plan: plan.name });
          return {};
        },
        onSubscriptionComplete: async ({ plan }) => {
          onEvent({ _tag: "subscription_activated", plan: plan.name });
        },
        onSubscriptionCancel: async ({ subscription }) => {
          onEvent({ _tag: "subscription_canceled", plan: subscription.plan });
        },
        onSubscriptionUpdate: async ({ subscription, stripeSubscription }) => {
          const from = subscription.status ?? "none";
          const to = stripeSubscription.status;
          if (isStatus(from) && isStatus(to) && !isExpectedChange(from, to)) {
            // Stripe stays the source of truth; an unexpected change is worth a look, not a refusal.
            onWarning("unexpected subscription change", {
              from,
              to,
              subscriptionId: subscription.id,
            });
          }
        },
      },
    }),
  ];
};
