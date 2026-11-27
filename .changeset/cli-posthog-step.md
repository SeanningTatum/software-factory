---
"create-tanstack-cf-saas": minor
---

The wizard says how to send analytics to PostHog: create a project, then run `bun run setup` per environment with `ANALYTICS_PROVIDER=posthog`, which asks for `POSTHOG_KEY` and uploads it. When Cloudflare setup is skipped, `create` now prints each feature's manual steps too.
