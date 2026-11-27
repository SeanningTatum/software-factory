---
"create-tanstack-cf-saas": minor
---

`create` asks for two PostHog project API keys, one for staging and one for production, and their cloud (US or EU). With them, both environments send analytics to PostHog, each to its own project, and Cloudflare setup uploads each key to its Worker; `dev` stays on the console. Leaving production's key empty shares staging's project. When Cloudflare setup is skipped, `create` now also prints each feature's manual steps, such as billing's Stripe webhook. The README gains a "Before you start" list of every key the wizard asks for.
