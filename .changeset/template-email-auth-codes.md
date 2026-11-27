---
"create-tanstack-cf-saas": minor
---

A new optional `email` module sends transactional mail through Cloudflare Email Service's `send_email` binding, with no API key; `wrangler dev` simulates it. Choose it with `auth` and you also get the `auth-email` feature: a mailed 8-digit code verifies each new address before its first sign-in, resets a forgotten password (`/forgot-password`) and signs in without one (`/sign-in-code`). `auth-email` is never listed: it is on whenever both are, `add email` brings it to a project that has auth, and `remove email` takes it out. `create` warns when auth is chosen without email, since auth alone has no password reset.
