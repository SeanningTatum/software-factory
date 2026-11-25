<!-- generated:start -->
<!-- Written by `cf-saas-blocks sync` from feature.json and the source. Edits here are lost. -->

# Home (`home`)

The home page and the /api/health check.

- Kind: feature, required; it can't be removed
- Depends on: none
- Used by: none
- Bindings: none
- Vars: none
- Secrets: none
- Also owns: none
- Feeds: `src/gen/nav.ts`, `src/gen/routes.ts`
- Routes: `/`, `/api/health`
- Services: none
- Errors: none
- Events: none
- Machines: none
<!-- generated:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

- 2026-11-24 — The production CSP adds `frame-src https://challenges.cloudflare.com` for the Turnstile widget (see auth). Why: `default-src 'self'` would block its frame; its script needs no source because `'strict-dynamic'` trusts scripts our nonced code adds.
- 2026-11-24 — Server functions refuse cross-site calls: `src/start.ts` adds Start's `csrf` middleware (`src/app/middleware.ts`), filtered to server functions. Why: Start warned in dev that they had no CSRF check; API routes (`/api/auth/*`, `/api/events`, Stripe webhooks) are not server functions and stay open.
- 2026-11-24 — `/api/health` answers 503 with what is wrong unless every required setting is set, `APP_URL` is the origin being served and D1 (when the project has a `DB` binding) answers `SELECT 1`. Why: the deploy smoke test passed a deploy with no secrets or a localhost `APP_URL`; it reads the binding through `core/lib` so a project without db still works.
- 2026-11-24 — Feature routes mount through generated virtual file routes: `src/gen/routes.ts` mounts each feature's `routes/` at the URL root, and `src/routes/` holds only `__root.tsx`. Why: adding or removing a feature adds or removes its pages, with no route folders to edit by hand.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->
