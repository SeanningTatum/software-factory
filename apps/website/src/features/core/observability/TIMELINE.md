<!-- generated:start -->
<!-- Written by `cf-saas-blocks sync` from feature.json and the source. Edits here are lost. -->

# Observability (`observability`)

JSON logs stamped with the request id and user, redaction, error reports to the console or Sentry, an optional alert webhook, and /api/browser-report.

- Kind: core module, required; it can't be removed
- Depends on: none
- Used by: none
- Bindings: `REPORT_LIMITER` (ratelimit)
- Vars: `ERROR_REPORTER`, `LOG_LEVEL`
- Secrets: `ALERT_WEBHOOK_URL`, `SENTRY_DSN`
- Also owns: `docs/runbook.md`
- Feeds: `src/gen/routes.ts`
- Routes: `/api/browser-report`
- Services: none
- Errors: none
- Events: none
- Machines: none
<!-- generated:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

- 2026-11-24 — Browser reports never alert, a failed webhook post reopens the quiet window, a setting that is not a URL is ignored, and alert text is capped with mentions off. Why: `/api/browser-report` is public, so one fake report could otherwise silence real alerts for five minutes.
- 2026-11-24 — Alerts go to an optional `ALERT_WEBHOOK_URL` (Slack or Discord), one per burst, then five quiet minutes per isolate. Why: the owner chose a webhook; it needs no paid product and can be tested here. A Durable Object can hold the window if bursts fan out.
- 2026-11-24 — `/api/browser-report` is rate-limited per address by the new `REPORT_LIMITER` binding (10 a minute) and reads at most 8 KB as it arrives. Why: anyone could spend the error tracker's quota, after which real errors are dropped.
- 2026-11-24 — Lives in `src/features/core/` as a services-only module; its only route is the server route `/api/browser-report`. Why: core holds shared modules of one kind, and this one is services and helpers.
- 2026-11-24 — Every log line is one JSON object stamped with the request id, the user and the current span. Why: Workers Logs reads JSON, and one id ties a request's lines together.
- 2026-11-24 — `lib/log-sink.ts` is the only file that writes to the console. Why: logs leave through one door, and Biome's `noConsole` stays on everywhere else.
- 2026-11-24 — Redaction turns emails into a short stable hash and strips tokens, keys, cookies and Stripe keys before anything is logged or reported. Why: logs hold no secrets or personal data, yet one user's lines can still be followed.
- 2026-11-24 — A missing or bad `ERROR_REPORTER` or `SENTRY_DSN` falls back to the console. Why: a wrong setting must never hide errors.
- 2026-11-24 — Errors go through Effect's `ErrorReporter`; Sentry gets an envelope built by hand and sent with fetch. Why: Biome bans the Sentry packages, so no SDK joins the Worker.
- 2026-11-24 — Browser errors post to `/api/browser-report` (8 KB cap, Schema-checked) and reach the same reporter as server errors. Why: one place to see every error.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->

- 2026-11-24 — Set `logpush: true` in `wrangler.jsonc`; the runbook now shows the R2 Logpush job and retention (3 or 7 days in Cloudflare, until the lifecycle rule in R2), a failed production deploy posts to `ALERT_WEBHOOK_URL`, and `src/app/runbook.test.ts` fails when any of it goes missing.
- 2026-11-24 — Added the alert webhook to the error reporter, and `docs/runbook.md` (listed in `files`): a bad deploy, a failed migration, a Stripe outage, finding a request, reading the audit log.
- 2026-11-24 — Moved to `src/features/core/observability/` from `src/features/observability/`.
- 2026-11-24 — Created from create-tanstack-cf-saas 0.1.0.
