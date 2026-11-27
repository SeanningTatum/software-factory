---
"@tanstack-cf-saas/lint": minor
"create-tanstack-cf-saas": patch
---

Add three lint rules: `one-component-per-file` (a `.tsx` file declares one component),
`class-placement` (no classes in React files or `components/`, none inside a function) and
`error-placement` (error classes live in their feature's `errors.ts`, or `src/app/errors.ts` for the
kernel). The template moves its error classes into each feature's `errors.ts` and splits `plan-card.tsx`.
