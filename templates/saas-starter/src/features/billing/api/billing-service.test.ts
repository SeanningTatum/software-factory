import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { type AppEnv, CloudflareEnv } from "#/app/env.ts";
import { makeTestDb, testDatabaseLayer } from "#/features/core/db/api/test-database.ts";
import { subscription } from "../schema.ts";
import { Billing } from "./billing-service.ts";

const stateFor = async (
  env: Record<string, string>,
  rows: Array<typeof subscription.$inferInsert>,
) => {
  const db = await makeTestDb({ subscription });
  if (rows.length) await db.insert(subscription).values(rows);
  return Effect.gen(function* () {
    const billing = yield* Billing;
    return yield* billing.stateFor("u1");
  }).pipe(
    Effect.provide(
      Billing.layer.pipe(
        Layer.provide(
          Layer.mergeAll(CloudflareEnv.layer(env as unknown as AppEnv), testDatabaseLayer(db)),
        ),
      ),
    ),
    Effect.runPromise,
  );
};

const KEYS = {
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  STRIPE_PRICE_PRO: "price_1",
};

describe("Billing.stateFor", () => {
  it("is free and unconfigured with no keys", async () => {
    expect(await stateFor({}, [])).toMatchObject({ configured: false, plan: "free", plans: [] });
  });

  it("shows the active subscription", async () => {
    const state = await stateFor(KEYS, [
      { id: "s1", plan: "pro", referenceId: "u1", status: "active" },
    ]);
    expect(state).toMatchObject({
      configured: true,
      entitled: true,
      plan: "pro",
      status: "active",
      plans: [{ name: "pro", label: "Pro" }],
    });
  });

  it("ignores canceled subscriptions and other users'", async () => {
    const state = await stateFor(KEYS, [
      { id: "s1", plan: "pro", referenceId: "u1", status: "canceled" },
      { id: "s2", plan: "pro", referenceId: "u2", status: "active" },
    ]);
    expect(state.plan).toBe("free");
  });

  it("does not entitle a subscription whose payment failed, but keeps it manageable", async () => {
    const state = await stateFor(KEYS, [
      { id: "s1", plan: "pro", referenceId: "u1", status: "past_due" },
    ]);
    expect(state).toMatchObject({ entitled: false, plan: "free", status: "past_due" });
  });
});
