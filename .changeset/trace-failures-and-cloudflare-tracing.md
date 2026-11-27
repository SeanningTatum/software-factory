---
"create-tanstack-cf-saas": minor
---

New projects trace failures they used to lose. A failed onboarding workflow step now writes an Error line with a `step` field and reaches Sentry and the alert webhook, then still fails so Cloudflare retries it. A 4xx `request failed` line now names the error (`error: "NotFound"`) beside its status. `wrangler.jsonc` turns on Cloudflare traces, Issues and `redact_query_string`: production keeps one trace in ten, staging keeps all, and logs are never sampled. `docs/runbook.md` says where to find them and that stored traces are billed from 1 December 2026.
