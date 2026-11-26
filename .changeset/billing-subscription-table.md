---
"create-tanstack-cf-saas": patch
"@tanstack-cf-saas/blocks": patch
---

The template gives Better Auth the `subscription` table, so a checkout or a Stripe webhook can store a plan; before, every subscription write failed. `cf-saas-blocks sync` writes `featureAuthTables` into `src/gen/auth-plugins.ts`: the tables of every feature that adds auth plugins, for Better Auth's database adapter.
