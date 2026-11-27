import { stripe } from "@better-auth/stripe";
import type { AuthContext, BetterAuthPlugin } from "better-auth";
import Stripe from "stripe";
import { setting } from "#/app/env.ts";
import type { AuthPluginFactory } from "#/features/auth/api/auth.ts";
import { plansFrom } from "./lib/plans.ts";
import { unexpectedChange } from "./lib/subscription-change.ts";

const WEBHOOK_PATH = "/stripe/webhook";
const SERVER_ERROR = 500;
const MS_PER_SECOND = 1000;

const dateOf = (seconds: number | null) => (seconds ? new Date(seconds * MS_PER_SECOND) : null);

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

export const authPlugins: AuthPluginFactory = (deps) => {
  const secretKey = setting(deps.env, "STRIPE_SECRET_KEY");
  const webhookSecret = setting(deps.env, "STRIPE_WEBHOOK_SECRET");
  if (!secretKey || !webhookSecret) return [];
  const stripeClient = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
  return billingPlugins(stripeClient, webhookSecret, deps);
};

export const billingPlugins = (
  stripeClient: Stripe,
  webhookSecret: string,
  { env, onEvent, onWarning, loggedErrors }: Parameters<AuthPluginFactory>[0],
): ReadonlyArray<BetterAuthPlugin> => {
  let adapter: AuthContext["adapter"] | undefined;
  return [
    stripe({
      stripeClient,
      stripeWebhookSecret: webhookSecret,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: plansFrom(env).map(({ name, priceId }) => ({ name, priceId })),
        getCheckoutSessionParams: ({ plan, user }) => {
          onEvent({ _tag: "checkout_started", plan: plan.name }, user.id);
          return {};
        },
        onSubscriptionComplete: async ({ plan, subscription }) => {
          onEvent({ _tag: "subscription_activated", plan: plan.name }, subscription.referenceId);
        },
        onSubscriptionCancel: async ({ subscription }) => {
          onEvent(
            { _tag: "subscription_canceled", plan: subscription.plan },
            subscription.referenceId,
          );
        },
        onSubscriptionUpdate: async ({ event, subscription, stripeSubscription }) => {
          const change = unexpectedChange(event, subscription.status);
          if (change)
            onWarning("unexpected subscription change", {
              ...change,
              subscriptionId: subscription.id,
            });
          const current = await stripeClient.subscriptions.retrieve(stripeSubscription.id);
          // shortcut: the first item's period; with several items a subscription, find the plan's as the plugin does.
          const item = current.items.data[0];
          await adapter?.update({
            model: "subscription",
            where: [{ field: "id", value: subscription.id }],
            update: {
              status: current.status,
              cancelAtPeriodEnd: current.cancel_at_period_end,
              cancelAt: dateOf(current.cancel_at),
              canceledAt: dateOf(current.canceled_at),
              endedAt: dateOf(current.ended_at),
              ...(item
                ? {
                    periodStart: dateOf(item.current_period_start),
                    periodEnd: dateOf(item.current_period_end),
                  }
                : {}),
            },
          });
        },
      },
    }),
    webhookRetry(loggedErrors),
    {
      id: "stripe-status-check",
      init: (context) => {
        adapter = context.adapter;
      },
    },
  ];
};
