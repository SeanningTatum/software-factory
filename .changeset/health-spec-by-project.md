---
"create-tanstack-cf-saas": patch
---

The template's `/api/health` spec decides by the project: with a `drizzle.config.ts` the response must report the database as up, and without one it must not report it. A lost `DB` binding now fails the spec.
