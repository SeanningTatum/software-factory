import type { Subscription, SubscriptionOptions } from "@better-auth/stripe";
import type { AuthContext } from "better-auth";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/app/env.ts";
import { authPlugins, billingPlugins, webhookRetry } from "./auth-plugins.ts";

const deps = (env: Record<string, string>) => ({
  env: env as unknown as AppEnv,
  onEvent: () => undefined,
  onWarning: () => undefined,
  loggedErrors: () => 0,
});

describe("billing auth plugins", () => {
  it("stay off without Stripe keys", () => {
    expect(authPlugins(deps({}))).toEqual([]);
  });
  it("add the Stripe plugin and its webhook retry once keys are set", () => {
    const plugins = authPlugins(
      deps({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" }),
    );
    expect(plugins.map((p) => p.id)).toEqual([
      "stripe",
      "stripe-webhook-retry",
      "stripe-status-check",
    ]);
  });
});

describe("webhookRetry", () => {
  const ctx = {} as AuthContext;
  const answer = async (path: string, errors: number, status = 200) => {
    const plugin = webhookRetry(() => errors);
    await plugin.onRequest?.(new Request(`https://x.dev/api/auth${path}`, { method: "POST" }), ctx);
    const replaced = await plugin.onResponse?.(new Response("{}", { status }), ctx);
    return replaced ? replaced.response.status : status;
  };

  it("turns a webhook the plugin swallowed into a 500, so Stripe retries", async () =>
    expect(await answer("/stripe/webhook", 1)).toBe(500));
  it("leaves a clean webhook alone", async () =>
    expect(await answer("/stripe/webhook", 0)).toBe(200));
  it("leaves other auth routes alone even when something was logged", async () =>
    expect(await answer("/sign-up/email", 1)).toBe(200));
});

// shortcut: calls the hook directly; a webhook end to end needs the subscription table in Better
// Auth's Drizzle schema, which auth does not pass yet.
describe("a late subscription update", () => {
  type UpdateData = Parameters<NonNullable<SubscriptionOptions["onSubscriptionUpdate"]>>[0];
  const run = async (written: string, inStripe: string) => {
    const stripeClient = new Stripe("sk_test_x");
    vi.spyOn(stripeClient.subscriptions, "retrieve").mockResolvedValue({
      status: inStripe,
    } as Awaited<ReturnType<typeof stripeClient.subscriptions.retrieve>>);
    const update = vi.fn(async () => null);
    const plugins = billingPlugins(stripeClient, "whsec_x", deps({ STRIPE_PRICE_PRO: "price_1" }));
    await plugins
      .find((p) => p.id === "stripe-status-check")
      ?.init?.({ adapter: { update } } as unknown as AuthContext);
    const { options } = plugins[0] as unknown as { options: { subscription: SubscriptionOptions } };
    await options.subscription.onSubscriptionUpdate?.({
      event: { data: { object: {}, previous_attributes: {} } },
      subscription: { id: "s1", status: written } as Subscription,
      stripeSubscription: { id: "sub_1", status: written },
    } as unknown as UpdateData);
    return update;
  };

  it("puts back Stripe's status when a stale update follows the delete", async () => {
    // The delete left the row canceled; an earlier update, retried, made the plugin write active.
    const update = await run("active", "canceled");
    expect(update).toHaveBeenCalledWith({
      model: "subscription",
      where: [{ field: "id", value: "s1" }],
      update: { status: "canceled" },
    });
  });

  it("writes nothing when the row already matches Stripe", async () => {
    expect(await run("active", "active")).not.toHaveBeenCalled();
  });
});
