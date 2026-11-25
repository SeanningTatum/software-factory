import { createClient } from "@libsql/client";
// Loaded with the file, not inside the first test: it is large, and on a busy CI runner loading it
// took longer than the 5 s a test gets.
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/libsql";
import { Layer } from "effect";
import { Database, type Db } from "./database.ts";

/**
 * A fresh in-memory SQLite database with the given Drizzle tables created, for tests that need
 * real SQL. Builds the DDL with drizzle-kit, so it always matches the schema files.
 */
export const makeTestDb = async (schema: Record<string, unknown>): Promise<Db> => {
  const client = createClient({ url: ":memory:" });
  const empty = await generateSQLiteDrizzleJson({});
  const target = await generateSQLiteDrizzleJson(schema);
  for (const statement of await generateSQLiteMigration(empty, target))
    await client.execute(statement);
  return drizzle(client) as unknown as Db;
};

export const testDatabaseLayer = (db: Db) => Layer.succeed(Database)(Database.fromDb(db));
