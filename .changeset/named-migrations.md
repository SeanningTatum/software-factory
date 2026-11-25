---
"create-tanstack-cf-saas": minor
---

Migrations are always named. The template's `db:generate` script now ends in `--name`, so `bun run db:generate add_invoices` writes `drizzle/0001_add_invoices.sql` and a run without a name fails instead of writing one of drizzle's random names. `create` names a new project's first migration `0000_init`.
