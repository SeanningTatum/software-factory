import { integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { makeTestDb } from "./test-database.ts";

describe("makeTestDb", () => {
  it("creates the tables it is given", async () => {
    const things = sqliteTable("thing", { id: integer("id").primaryKey() });
    const db = await makeTestDb({ things });
    await db.insert(things).values({ id: 7 });
    expect(await db.select().from(things)).toEqual([{ id: 7 }]);
  });
});
