<!-- generated:start -->
<!-- Written by `cf-saas-blocks sync` from feature.json and the source. Edits here are lost. -->

# Observability (`observability`)

JSON logs stamped with the request id and user, redaction, error reports to the console or Sentry, and /api/browser-report.

- Kind: core; it can't be removed
- Depends on: none
- Used by: none
- Bindings: none
- Vars: `ERROR_REPORTER`, `LOG_LEVEL`
- Secrets: `SENTRY_DSN`
- Also owns: none
- Feeds: `src/gen/routes.ts`
- Routes: `/api/browser-report`
- Services: none
- Errors: none
- Events: none
- Machines: none
<!-- generated:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

- 2026-11-24 — Every log line is one JSON object stamped with the request id, the user and the current span. Why: Workers Logs reads JSON, and one id ties a request's lines together.
- 2026-11-24 — `lib/log-sink.ts` is the only file that writes to the console. Why: logs leave through one door, and Biome's `noConsole` stays on everywhere else.
- 2026-11-24 — Redaction turns emails into a short stable hash and strips tokens, keys, cookies and Stripe keys before anything is logged or reported. Why: logs hold no secrets or personal data, yet one user's lines can still be followed.
- 2026-11-24 — A missing or bad `ERROR_REPORTER` or `SENTRY_DSN` falls back to the console. Why: a wrong setting must never hide errors.
- 2026-11-24 — Errors go through Effect's `ErrorReporter`; Sentry gets an envelope built by hand and sent with fetch. Why: Biome bans the Sentry packages, so no SDK joins the Worker.
- 2026-11-24 — Browser errors post to `/api/browser-report` (8 KB cap, Schema-checked) and reach the same reporter as server errors. Why: one place to see every error.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->

- 2026-11-24 — Moved into `src/features/observability/` from `src/core/` (log, redact, error-reporter, log-sink) when the template switched from blocks to features.
