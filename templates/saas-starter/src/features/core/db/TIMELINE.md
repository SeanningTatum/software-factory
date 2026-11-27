<!-- generated:start -->
<!-- Written by `software-factory-blocks sync` from feature.json and the source. Edits here are lost. -->

# D1 database (`db`)

Cloudflare D1 (SQLite) through Drizzle, as an Effect Database service, with real-SQL tests.

- Kind: core module, optional; `software-factory-blocks remove db` takes it out
- Depends on: none
- Used by: [auth](../../auth/TIMELINE.md)
- Bindings: `DB` (d1)
- Vars: none
- Secrets: none
- Also owns: `drizzle`, `drizzle.config.ts`
- Feeds: `src/gen/layers.ts`, `src/gen/errors.ts`
- Routes: none
- Services: `Database`
- Errors: `DatabaseError`
- Events: none
- Machines: none
<!-- generated:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

- 2026-11-24 — Lives in `src/features/core/` as a services-only module and stays optional. Why: core holds shared modules of one kind, and db is a service that auth and billing build on, with no components or pages.
- 2026-11-24 — Without the `DB` binding the layer still builds and every query fails with `NotConfigured`. Why: the rest of the app keeps working, and the error names what is missing.
- 2026-11-24 — Every query the app writes goes through `Database.query(operation, run)`, which adds a `db.<operation>` span and wraps failures in `DatabaseError`; Better Auth takes the Drizzle handle `Database.db` and runs its own. Why: each query is traced and fails in the error channel, and Better Auth only accepts a handle.
- 2026-11-24 — Tests run real SQL on in-memory libSQL, with tables built by drizzle-kit from the schema files. Why: the test tables always match the schema.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->
