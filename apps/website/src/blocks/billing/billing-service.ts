import { and, eq, inArray } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { Database, type DatabaseError } from "#/blocks/d1/database.ts";
import { CloudflareEnv, setting } from "#/core/env.ts";
import type { NotConfigured } from "#/core/errors.ts";
import { FREE_PLAN, type Plan, plansFrom } from "./plans.ts";
import { subscription } from "./schema.ts";

export interface BillingState {
  /** False until Stripe keys and a price are set; the page then says what is missing. */
  readonly configured: boolean;
  readonly plan: string;
  readonly status: string | undefined;
  readonly cancelAtPeriodEnd: boolean;
  readonly plans: ReadonlyArray<Pick<Plan, "name" | "label">>;
}

export class Billing extends Context.Service<
  Billing,
  {
    readonly stateFor: (
      userId: string,
    ) => Effect.Effect<BillingState, DatabaseError | NotConfigured>;
  }
>()("app/blocks/billing/Billing") {
  static readonly layer = Layer.effect(
    Billing,
    Effect.gen(function* () {
      const env = yield* CloudflareEnv;
      const database = yield* Database;
      const plans = plansFrom(env);
      const configured = Boolean(
        setting(env, "STRIPE_SECRET_KEY") && setting(env, "STRIPE_WEBHOOK_SECRET") && plans.length,
      );

      const stateFor = Effect.fn("Billing.stateFor")(function* (userId: string) {
        const rows = yield* database.query("subscription.current", (db) =>
          db
            .select()
            .from(subscription)
            .where(
              and(
                eq(subscription.referenceId, userId),
                inArray(subscription.status, ["active", "trialing", "past_due"]),
              ),
            )
            .limit(1),
        );
        const current = rows[0];
        return {
          configured,
          plan: current?.plan ?? FREE_PLAN,
          status: current?.status,
          cancelAtPeriodEnd: current?.cancelAtPeriodEnd ?? false,
          plans: plans.map(({ name, label }) => ({ name, label })),
        } satisfies BillingState;
      });
      return Billing.of({ stateFor });
    }),
  );
}
