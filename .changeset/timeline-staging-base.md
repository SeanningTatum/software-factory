---
"@tanstack-cf-saas/lint": patch
---

`cf-saas-lint timeline` with no `--base` now compares with `origin/staging` first, then `origin/main`, then the last commit. Projects made by the CLI have `staging` as their default branch, so the old default fell through to the last commit and missed earlier ones.
