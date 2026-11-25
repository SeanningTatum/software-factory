---
"create-tanstack-cf-saas": patch
"@tanstack-cf-saas/lint": patch
---

New lint rule `no-nested-yield`: a `yield*` may not sit inside another `yield*` in the same generator, in source or tests. Write `const uploads = yield* Uploads;` and then `yield* uploads.list(...)`, not `yield* (yield* Uploads).list(...)`. The template's routes, onboarding steps and tests are rewritten to match.
