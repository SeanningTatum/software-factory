<!-- generated:start -->
<!-- Written by `cf-saas-blocks sync` from feature.json and the source. Edits here are lost. -->

# Docs (`docs`)

The documentation pages: MDX from content/docs, rendered with Fumadocs, with a sidebar and search.

- Kind: feature, optional; `cf-saas-blocks remove docs` takes it out
- Depends on: none
- Used by: none
- Bindings: none
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

- 2026-11-27 — Docs pages are MDX in `content/docs`, loaded and laid out by Fumadocs. Why: it supplies the sidebar, table of contents and search on TanStack Start, so we write none of them.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->

- 2026-11-27 — Added the feature as a spike: one page, the docs layout and `/api/search`.
