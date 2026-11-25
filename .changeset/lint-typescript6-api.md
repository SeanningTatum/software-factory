---
"@tanstack-cf-saas/lint": patch
---

`cf-saas-lint` now reads source through `@typescript/typescript6` instead of `typescript`. TypeScript 7 no longer ships the JavaScript API the linter parses with, so a project on TypeScript 7 crashed on lint. The linter brings its own copy now, and works whichever TypeScript the project compiles with.
