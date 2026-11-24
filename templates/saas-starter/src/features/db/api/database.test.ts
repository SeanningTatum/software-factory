import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { Effect, Exit, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { type AppEnv, CloudflareEnv } from "#/app/env.ts";
import { Database } from "./database.ts";
import { makeTestDb, testDatabaseLayer } from "./test-database.ts";

const notes = sqliteTable("note", { id: integer("id").primaryKey(), body: text("body").notNull() });

describe("Database", () => {
  it("runs queries against real SQL", async () => {
    const db = await makeTestDb({ notes });
    const rows = await Effect.gen(function* () {
      const database = yield* Database;
      yield* database.query("note.insert", (d) => d.insert(notes).values({ body: "hello" }));
      return yield* database.query("note.list", (d) => d.select().from(notes));
    }).pipe(Effect.provide(testDatabaseLayer(db)), Effect.runPromise);
    expect(rows).toEqual([{ id: 1, body: "hello" }]);
  });

  it("turns a failing query into a DatabaseError naming the operation", async () => {
    const db = await makeTestDb({ notes });
    const exit = await Effect.gen(function* () {
      const database = yield* Database;
      return yield* database.query("broken", (d) => d.run(sql`select * from missing_table`));
    }).pipe(Effect.provide(testDatabaseLayer(db)), Effect.runPromiseExit);
    expect(exit).toMatchObject({ _tag: "Failure" });
    expect(JSON.stringify(Exit.isFailure(exit) ? exit.cause : null)).toContain("broken");
  });

  it("builds without a binding; each query then fails with NotConfigured", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        return yield* (yield* Database).query("anything", async () => 1);
      }).pipe(
        Effect.provide(Database.layer.pipe(Layer.provide(CloudflareEnv.layer({} as AppEnv)))),
      ),
    );
    expect(JSON.stringify(exit)).toContain("NotConfigured");
  });
});
