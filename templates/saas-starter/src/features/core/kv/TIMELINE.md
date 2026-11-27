<!-- generated:start -->
<!-- Written by `software-factory-blocks sync` from feature.json and the source. Edits here are lost. -->

# KV (`kv`)

A Workers KV namespace behind a typed, Schema-checked KeyValue service with a read-through cache helper.

- Kind: core module, optional; `software-factory-blocks remove kv` takes it out
- Depends on: none
- Used by: none
- Bindings: `KV` (kv)
- Vars: none
- Secrets: none
- Also owns: none
- Feeds: `src/gen/layers.ts`, `src/gen/errors.ts`
- Routes: none
- Services: `KeyValue`
- Errors: `KvError`
- Events: none
- Machines: none
<!-- generated:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

- 2026-11-24 — Lives in `src/features/core/` as a services-only module and stays optional. Why: it is a shared service with no components or pages.
- 2026-11-24 — Without the `KV` binding the layer still builds and every call fails with `NotConfigured`. Why: the rest of the app keeps working, and the error names what is missing.
- 2026-11-24 — Values are Schema-encoded JSON, and one that no longer decodes counts as a miss, not an error. Why: changing a schema must not break reads of old values.
- 2026-11-24 — TTLs under 60 seconds are raised to 60. Why: that is the shortest expiry KV accepts.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->
