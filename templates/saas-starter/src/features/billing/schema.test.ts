import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { makeTestDb } from "#/features/core/db/api/test-database.ts";
import { subscription } from "./schema.ts";

describe("billing schema", () => {
  it.each(["reference_id", "stripe_subscription_id", "stripe_customer_id"])(
    "looks subscriptions up by %s through an index",
    async (column) => {
      const db = await makeTestDb({ subscription });
      const plan = await db.all<{ detail: string }>(
        sql.raw(`EXPLAIN QUERY PLAN SELECT * FROM "subscription" WHERE "${column}" = 'x'`),
      );
      expect(plan.map((row) => row.detail).join(" ")).toMatch(/USING INDEX/);
    },
  );
});
