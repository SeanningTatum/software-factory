<!-- generated:start -->
<!-- Written by `cf-saas-blocks sync` from feature.json and the source. Edits here are lost. -->

# UI (`ui`)

shadcn/ui components, the cn helper, useHydrated, and the site header and footer.

- Kind: core module, required; it can't be removed
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

- 2026-11-24 — ui is a components-only core module: no services, routes or machines, and it imports no feature. Why: core holds shared modules of one kind; so the footer takes the cookie settings button as children instead of importing consent.
- 2026-11-24 — `Button` stays disabled until React hydrates, through the `components/use-hydrated.ts` hook, and the footer's cookie settings button does the same. Why: a click before hydration did nothing, or sent a form natively as a GET with the password in the URL.
- 2026-11-24 — Components are shadcn/ui (new-york style) in `components/`, where `biome.json` allows default exports. Why: shadcn generates them that way, and we keep them close to upstream.
- 2026-11-24 — `cn` merges class names with clsx and tailwind-merge. Why: later Tailwind classes win over earlier ones without hand-written checks.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->
