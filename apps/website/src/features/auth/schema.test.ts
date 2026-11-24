import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { makeTestDb } from "#/features/core/db/api/test-database.ts";
import { authSchema } from "./schema.ts";

/** Every lookup Better Auth makes by a column other than the primary key uses an index. */
describe("auth schema", () => {
  it.each([
    ["account", "user_id"],
    ["session", "user_id"],
    ["verification", "identifier"],
    ["user", "stripe_customer_id"],
  ])("looks %s up by %s through an index", async (table, column) => {
    const db = await makeTestDb(authSchema);
    const plan = await db.all<{ detail: string }>(
      sql.raw(`EXPLAIN QUERY PLAN SELECT * FROM "${table}" WHERE "${column}" = 'x'`),
    );
    expect(plan.map((row) => row.detail).join(" ")).toMatch(/USING INDEX/);
  });
});
