import { drizzle } from "drizzle-orm/d1";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { Context, Effect, Layer, Schema } from "effect";
import { CloudflareEnv } from "#/core/env.ts";
import { NotConfigured } from "#/core/errors.ts";

/** Any async SQLite Drizzle database: D1 in the Worker, libSQL in tests. */
export type Db = BaseSQLiteDatabase<"async", unknown>;

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export class Database extends Context.Service<
  Database,
  {
    /** The Drizzle handle, for libraries such as Better Auth that take one; undefined without a binding. */
    readonly db: Db | undefined;
    /** Runs one query. The name becomes the span name and appears in errors. */
    readonly query: <A>(
      operation: string,
      run: (db: Db) => Promise<A>,
    ) => Effect.Effect<A, DatabaseError | NotConfigured>;
  }
>()("app/blocks/d1/Database") {
  static readonly fromDb = (db: Db) =>
    Database.of({
      db,
      query: (operation, run) =>
        Effect.tryPromise({
          try: () => run(db),
          catch: (cause) => new DatabaseError({ operation, cause }),
        }).pipe(Effect.withSpan(`db.${operation}`, { kind: "client" })),
    });

  /** Without a binding every query fails with NotConfigured; the rest of the app keeps working. */
  static readonly unconfigured = Database.of({
    db: undefined,
    query: () => Effect.fail(new NotConfigured({ setting: "DB (D1 binding)" })),
  });

  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function* () {
      const env = yield* CloudflareEnv;
      const binding = (env as unknown as { DB?: D1Database }).DB;
      return binding ? Database.fromDb(drizzle(binding) as unknown as Db) : Database.unconfigured;
    }),
  );
}
