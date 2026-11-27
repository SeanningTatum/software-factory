// software-factory-lint allow comments
import type { Subscription, SubscriptionOptions } from "@better-auth/stripe";
import type { AuthContext } from "better-auth";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/app/env.ts";
import { makeAuth } from "#/features/auth/api/auth.ts";
import { authSchema } from "#/features/auth/schema.ts";
import { makeTestDb } from "#/features/core/db/api/test-database.ts";
import { featureAuthTables } from "#/gen/auth-plugins.ts";
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

describe("the subscription table", () => {
  it("is one Better Auth can write, so a checkout or a webhook can store a plan", async () => {
    const db = await makeTestDb({ ...authSchema, ...featureAuthTables });
    const auth = makeAuth(
      { secret: "x".repeat(32), baseURL: "https://x.dev", trustedOrigins: [] },
      db,
      billingPlugins(new Stripe("sk_test_x"), "whsec_x", deps({})),
      () => undefined,
      featureAuthTables,
    );
    const { adapter } = await auth.$context;
    const row = await adapter.create<Record<string, unknown>, { id: string }>({
      model: "subscription",
      data: { plan: "pro", referenceId: "u1", status: "incomplete" },
    });
    const where = [{ field: "id", value: row.id }];
    await adapter.update({ model: "subscription", where, update: { status: "active" } });
    expect(await adapter.findOne({ model: "subscription", where })).toMatchObject({
      plan: "pro",
      referenceId: "u1",
      status: "active",
    });
  });
});

// shortcut: calls the hook directly, not through a signed webhook; B-07 runs one end to end.
describe("a late subscription update", () => {
  type UpdateData = Parameters<NonNullable<SubscriptionOptions["onSubscriptionUpdate"]>>[0];
  const run = async (written: string, inStripe: Record<string, unknown>) => {
    const stripeClient = new Stripe("sk_test_x");
    vi.spyOn(stripeClient.subscriptions, "retrieve").mockResolvedValue({
      cancel_at_period_end: false,
      cancel_at: null,
      canceled_at: null,
      ended_at: null,
      items: { data: [{ current_period_start: 100, current_period_end: 200 }] },
      ...inStripe,
    } as unknown as Awaited<ReturnType<typeof stripeClient.subscriptions.retrieve>>);
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
    return update.mock.calls.map((call) => (call as Array<unknown>)[0]);
  };
  const period = { periodStart: new Date(100_000), periodEnd: new Date(200_000) };

  it("puts back Stripe's status when a stale update follows the delete", async () => {
    expect(await run("active", { status: "canceled", canceled_at: 150, ended_at: 150 })).toEqual([
      {
        model: "subscription",
        where: [{ field: "id", value: "s1" }],
        update: {
          status: "canceled",
          cancelAtPeriodEnd: false,
          cancelAt: null,
          canceledAt: new Date(150_000),
          endedAt: new Date(150_000),
          ...period,
        },
      },
    ]);
  });

  it("puts back the cancel flag and the period end when only they are stale", async () => {
    const [written] = await run("active", { status: "active", cancel_at_period_end: true });
    expect(written).toMatchObject({
      update: { status: "active", cancelAtPeriodEnd: true, periodEnd: new Date(200_000) },
    });
  });
});
