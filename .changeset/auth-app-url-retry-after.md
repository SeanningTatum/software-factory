---
"create-tanstack-cf-saas": patch
---

Template fixes in auth and the kernel. An `APP_URL` without a scheme (`myapp.example.com`) now leaves auth unconfigured with a 503 naming `APP_URL (a full https:// URL)`, instead of making every route answer 500. Every 429 now carries a `retry-after` header. `request-password-reset` is off the rate-limited list until a reset sender is wired; auth's `TIMELINE.md` says what to wire before launch.
