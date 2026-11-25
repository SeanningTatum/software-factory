---
"create-tanstack-cf-saas": minor
---

`create` now asks for the settings a chosen feature can't work without (billing's Stripe keys and price), writes the answers into `.dev.vars`, and warns about any left empty. It then offers to save the secrets to Cloudflare with `wrangler secret put`, to staging or production. `--yes` skips all of it.

- Breaking: auth signs in with email and password only. `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are gone; add a provider to `socialProviders` in `api/auth.ts` when you need one.
- Breaking: workflows has no HTTP trigger. `/api/workflows/onboarding` and `WORKFLOWS_TRIGGER_TOKEN` are gone; start a run from server code with the `Onboarding` service, which reads the `ONBOARDING_WORKFLOW` binding.
