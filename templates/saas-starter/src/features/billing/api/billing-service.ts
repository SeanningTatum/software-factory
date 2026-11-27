import { and, eq, inArray } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { CloudflareEnv, setting } from "#/app/env.ts";
import type { NotConfigured } from "#/app/errors.ts";
import { Database, type DatabaseError } from "#/features/core/db/api/database.ts";
import { FREE_PLAN, type Plan, plansFrom } from "../lib/plans.ts";
import { isEntitled, isStatus } from "../machines/subscription.machine.ts";
import { subscription } from "../schema.ts";

export interface BillingState {
  readonly configured: boolean;
  /** Gate on this; it is the one place that decides. */
  readonly entitled: boolean;
  readonly plan: string;
  /** Set while there is a subscription to manage, even when not entitled. */
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
>()("app/features/billing/Billing") {
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
                inArray(subscription.status, ["active", "trialing", "past_due", "unpaid"]),
              ),
            ),
        );
        // A user can hold several live rows (past_due or unpaid beside active): the entitled one wins.
        const entitledRow = rows.find((row) => isStatus(row.status) && isEntitled(row.status));
        const current = entitledRow ?? rows[0];
        const entitled = Boolean(entitledRow);
        return {
          configured,
          entitled,
          plan: entitled && current ? current.plan : FREE_PLAN,
          status: current?.status,
          cancelAtPeriodEnd: current?.cancelAtPeriodEnd ?? false,
          plans: plans.map(({ name, label }) => ({ name, label })),
        } satisfies BillingState;
      });
      return Billing.of({ stateFor });
    }),
  );
}
