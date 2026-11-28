<!-- generated:start -->
<!-- Written by `software-factory-blocks sync` from feature.json and the source. Edits here are lost. -->

# Docs (`docs`)

The documentation pages: MDX from content/docs, rendered with Fumadocs, with a sidebar and search.

- Kind: feature, optional; `software-factory-blocks remove docs` takes it out
- Depends on: none
- Used by: none
- Bindings: `SEARCH_LIMITER` (ratelimit)
- Vars: none
- Secrets: none
- Also owns: `content`
- Feeds: `src/gen/nav.ts`, `src/gen/routes.ts`
- Routes: `/api/search`, `/docs/$`
- Services: none
- Errors: none
- Events: none
- Machines: none
<!-- generated:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

- 2026-11-27 — `/api/search` allows 60 requests per 60 seconds per address (`SEARCH_LIMITER`). Why: search-as-you-type sends a request per pause in typing, and an unlimited full-text search lets one client burn Worker CPU.
- 2026-11-27 — Docs pages are MDX in `content/docs`, loaded and laid out by Fumadocs. Why: it supplies the sidebar, table of contents and search on TanStack Start, so we write none of them.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->

- 2026-11-28 — The docs nav shows the Software Factory wordmark in place of "Docs".
- 2026-11-27 — Getting started opens with what Software Factory is, to match the README after the rename.
- 2026-11-27 — Two docs e2e tests: the theme button stays inside the window, and `/docs` passes the accessibility check in dark mode.
- 2026-11-27 — The search limiter got random namespace ids like the other limiters, and the search test now checks the hits.
- 2026-11-27 — Pages load lazily, one chunk each. The theme provider moved to the root route and the app's colours follow its `dark` class, so the sidebar's theme button works on every page.

- 2026-11-27 — `/api/search` now runs through `runResponse` with a rate limit, so a search failure is logged with its cause.
- 2026-11-27 — Added the feature as a spike: one page, the docs layout and `/api/search`.
