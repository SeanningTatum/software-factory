---
"@tanstack-cf-saas/lint": minor
"create-tanstack-cf-saas": minor
---

The test map now needs a browser spec for every route file: `e2e/<route>.route.spec.ts`, where `{route}` is the path under `routes/` with `/` as `.` and `$` dropped. A core module's routes take theirs in `home`. A map entry with `always: true` also applies to files in `testExempt`.

The template it ships has a working and a failing browser spec for each page and API route, an axe scan in every page spec, coverage floors in `bun run test`, and a size budget for every page: `bun run size` now fails on a page with no budget.
