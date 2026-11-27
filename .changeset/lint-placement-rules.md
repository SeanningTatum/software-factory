---
"@tanstack-cf-saas/lint": minor
"create-tanstack-cf-saas": patch
---

Add three lint rules. `server-fn-placement`: a feature's `createServerFn` calls live in its `api/`,
and pages import them. `no-repeated-api-path`: an `/api/` path is written in one file only, apart
from the route's own `createFileRoute` call and tests. The template moves its page server functions
into each feature's `api/loaders.ts` and its auth paths into `auth/constants.ts`.

`no-restating-test`: a test whose every `expect` checks an imported constant against a literal
fails, since it repeats the source. Projects list such declaration-only files in `testExempt`; the
template now exempts `constants.ts`.
