---
"create-tanstack-cf-saas": minor
"@tanstack-cf-saas/blocks": minor
---

With `auth`, sign-up can need a Cloudflare Turnstile token. Set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` and `/signup` shows the widget and Better Auth refuses a sign-up without a valid token (400 with none, 403 when Cloudflare rejects it); leave them empty and sign-up works as before. `.dev.vars.example` carries Cloudflare's always-pass test keys, so dev and the browser specs run guarded; put real keys in at deploy. The production CSP gains `frame-src https://challenges.cloudflare.com`. `cf-saas-blocks` supports an `example` on a var or secret in `feature.json`, shown in `.dev.vars.example` in place of its deployed default.
