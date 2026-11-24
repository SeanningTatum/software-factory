<!-- generated:start -->
<!-- Written by `cf-saas-blocks sync` from feature.json and the source. Edits here are lost. -->

# Site (`site`)

The website's own pages: the landing page at / and the docs under /docs.

- Kind: core; it can't be removed
- Depends on: none
- Used by: none
- Bindings: none
- Vars: none
- Secrets: none
- Also owns: none
- Feeds: `src/gen/nav.ts`, `src/gen/routes.ts`
- Routes: `/`, `/docs`, `/docs/claude`, `/docs/features`, `/docs/rules`, `/docs/setup`
- Services: none
- Errors: none
- Events: none
- Machines: none
<!-- generated:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

- 2026-11-24 — The site is a core feature that only this website has; the rest of the app is the template as the CLI makes it with every feature. Why: regenerating the website from a newer template then means copying back one folder and redoing three small edits: the app name, removing `home/routes/index.tsx`, and the package name and `workspace:*` versions.
- 2026-11-24 — The landing page owns `/`, so the website drops `home/routes/index.tsx` and keeps home's `/api/health` and its Home nav entry. Why: two features can't both serve `/`, and the health check is what the deploy workflow tests.
- 2026-11-24 — `lib/features.ts` holds the words the pages use for each optional feature, and its test checks the names and `requires` against each `feature.json`. Why: the copy is written for people, but it must not drift from what the CLI offers.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->

- 2026-11-24 — Moved the landing page and docs from `src/routes/` and `src/site/` into this feature, regenerated the rest of the website with the feature layout, and renamed `/docs/blocks` to `/docs/features`.
