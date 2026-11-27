import { drizzle } from "drizzle-orm/d1";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { Context, Effect, Layer, Schema } from "effect";
import { CloudflareEnv } from "#/app/env.ts";
import { NotConfigured } from "#/app/errors.ts";
import { binding } from "#/features/core/lib/binding.ts";
import { outsideCall } from "#/features/core/lib/call.ts";

/** Any async SQLite Drizzle database: D1 in the Worker, libSQL in tests. */
export type Db = BaseSQLiteDatabase<"async", unknown>;

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export class Database extends Context.Service<
  Database,
  {
    /** For libraries such as Better Auth that take one. */
    readonly db: Db | undefined;
    /** The name becomes the span name and appears in errors. */
    readonly query: <A>(
      operation: string,
      run: (db: Db) => Promise<A>,
    ) => Effect.Effect<A, DatabaseError | NotConfigured>;
  }
>()("app/features/db/Database") {
  static readonly fromDb = (db: Db) =>
    Database.of({
      db,
      query: (operation, run) =>
        outsideCall(
          `db.${operation}`,
          () => run(db),
          (cause) => new DatabaseError({ operation, cause }),
        ),
    });

  static readonly unconfigured = Database.of({
    db: undefined,
    query: () => Effect.fail(new NotConfigured({ setting: "DB (D1 binding)" })),
  });

  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function* () {
      const env = yield* CloudflareEnv;
      const d1 = binding<D1Database>(env, "DB");
      return d1 ? Database.fromDb(drizzle(d1) as unknown as Db) : Database.unconfigured;
    }),
  );
}
