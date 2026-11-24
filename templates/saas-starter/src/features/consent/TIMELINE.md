<!-- generated:start -->
<!-- Written by `cf-saas-blocks sync` from feature.json and the source. Edits here are lost. -->

# Consent (`consent`)

The cookie consent banner and its state machine. Honours Do Not Track and Global Privacy Control.

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
- Machines: `components/consent.machine.ts`. Diagrams under Machines, from `bun run machines:print`.
<!-- generated:end -->

<!-- machines:start -->

## Machines

Written by `bun run machines:print`. `bun run test` fails when a diagram is out of date.

### consent

Source: `src/features/consent/components/consent.machine.ts`

```mermaid
stateDiagram-v2
  [*] --> resolving
  resolving --> blocked : always
  resolving --> granted : always
  resolving --> denied : always
  resolving --> asking : always
  asking --> granted : ACCEPT
  asking --> denied : DECLINE
  granted --> asking : REOPEN
  denied --> asking : REOPEN
  blocked --> [*]
```

<!-- machines:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

- 2026-11-24 — Consent is a machine: Do Not Track or Global Privacy Control blocks it with no banner, a saved cookie decides next, and a first visit asks. Why: each outcome is a state with a unit test and an e2e path spec.
- 2026-11-24 — The choice is saved with `document.cookie`. Why: the Cookie Store API is not in every browser yet.
- 2026-11-24 — Consent gates browser events only; server events from signed-in flows do not wait for it. Why: those record what the server did, not what the browser saw.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->

- 2026-11-24 — The banner's buttons stay disabled until hydration, through the shared `Button`; before, an early click on Allow or No thanks was lost and the banner stayed. Added an SSR test for it.
- 2026-11-24 — Moved into `src/features/consent/` from `src/core/consent/` when the template switched from blocks to features.
