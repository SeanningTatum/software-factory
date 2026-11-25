---
"create-tanstack-cf-saas": minor
"@tanstack-cf-saas/lint": minor
---

`cf-saas-lint` adds the `rules-file` rule: it fails when `CLAUDE.md` runs past `maxRulesLines` (80 by default) or names something that is not there: a backticked path whose top folder exists but which does not, a `bun run` script missing from `package.json`, or a "rule `x`" that is not a rule.

The template it ships now writes an `audit_log` row for every sign-up, sign-in (failed ones too), sign-out and plan change; posts the first error of a burst to an optional `ALERT_WEBHOOK_URL`; ships `docs/runbook.md`; ties a consented anonymous id to the user at sign-up and sign-in, and resets it at sign-out; and has each feature's `events.ts` export a `metric` that a test checks against the event catalog.
