import { stripe } from "@better-auth/stripe";
import type { BetterAuthPlugin } from "better-auth";
import Stripe from "stripe";
import { setting } from "#/app/env.ts";
import type { AuthPluginFactory } from "#/features/auth/api/auth.ts";
import { plansFrom } from "./lib/plans.ts";
import { unexpectedChange } from "./lib/subscription-change.ts";

const WEBHOOK_PATH = "/stripe/webhook";
const SERVER_ERROR = 500;

/**
 * The Stripe plugin catches a failed webhook (a D1 error, say), logs it and still answers 200, so
 * Stripe would never send it again. When Better Auth logged an error while handling the webhook,
 * answer 500 instead: Stripe retries, and the handlers only write by id, so a retry is safe.
 */
export const webhookRetry = (loggedErrors: () => number): BetterAuthPlugin => {
  let webhook = false;
  return {
    id: "stripe-webhook-retry",
    onRequest: async (request) => {
      webhook = new URL(request.url).pathname.endsWith(WEBHOOK_PATH);
    },
    onResponse: async (response) =>
      webhook && response.ok && loggedErrors() > 0
        ? {
            response: Response.json(
              { message: "Webhook failed; Stripe will retry." },
              { status: SERVER_ERROR },
            ),
          }
        : undefined,
  };
};

/**
 * Adds Stripe to Better Auth. Without STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET billing stays off
 * and the rest of the app works; /billing explains what is missing.
 */
export const authPlugins: AuthPluginFactory = ({ env, onEvent, onWarning, loggedErrors }) => {
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
        onSubscriptionUpdate: async ({ event, subscription }) => {
          const change = unexpectedChange(event, subscription.status);
          // Stripe stays the source of truth; an unexpected change is worth a look, not a refusal.
          if (change)
            onWarning("unexpected subscription change", {
              ...change,
              subscriptionId: subscription.id,
            });
        },
      },
    }),
    webhookRetry(loggedErrors),
  ];
};
