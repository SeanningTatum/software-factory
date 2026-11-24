<!-- generated:start -->
<!-- Written by `cf-saas-blocks sync` from feature.json and the source. Edits here are lost. -->

# Home (`home`)

The home page and the /api/health check.

- Kind: core; it can't be removed
- Depends on: none
- Used by: none
- Bindings: none
- Vars: none
- Secrets: none
- Also owns: none
- Feeds: `src/gen/nav.ts`, `src/gen/routes.ts`
- Routes: `/api/health`
- Services: none
- Errors: none
- Events: none
- Machines: none
<!-- generated:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

- 2026-11-24 — Feature routes mount through generated virtual file routes: `src/gen/routes.ts` mounts each feature's `routes/` at the URL root, and `src/routes/` holds only `__root.tsx`. Why: adding or removing a feature adds or removes its pages, with no route folders to edit by hand.
- 2026-11-24 — `/api/health` answers `{ ok, requestId }` and checks no bindings. Why: the deploy workflow smoke-tests it after each deploy and rolls production back when it fails.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->

- 2026-11-24 — Removed `routes/index.tsx`; the `site` feature serves `/` on this website.
- 2026-11-24 — Created from create-tanstack-cf-saas 0.1.0.
