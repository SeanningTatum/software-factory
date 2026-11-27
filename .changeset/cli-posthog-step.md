---
"create-tanstack-cf-saas": minor
---

`create` asks for a PostHog project API key and its cloud (US or EU). With one, staging and production send analytics to PostHog, and Cloudflare setup uploads the key to both; `dev` stays on the console. When Cloudflare setup is skipped, `create` now also prints each feature's manual steps, such as billing's Stripe webhook.
