<!-- generated:start -->
<!-- Written by `cf-saas-blocks sync` from feature.json and the source. Edits here are lost. -->

# UI (`ui`)

shadcn/ui components, the cn helper, and the site header and footer.

- Kind: core; it can't be removed
- Depends on: none
- Used by: none
- Bindings: none
- Vars: none
- Secrets: none
- Also owns: none
- Feeds: none
- Routes: none
- Services: none
- Errors: none
- Events: none
- Machines: none
<!-- generated:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

- 2026-11-24 — Components are shadcn/ui (new-york style) in `components/`, the one place Biome allows default exports. Why: shadcn generates them that way, and we keep them close to upstream.
- 2026-11-24 — `cn` merges class names with clsx and tailwind-merge. Why: later Tailwind classes win over earlier ones without hand-written checks.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->

- 2026-11-24 — Moved into `src/features/ui/` from `src/components/` and `src/lib/cn.ts` when the template switched from blocks to features.
