---
"create-tanstack-cf-saas": patch
"@tanstack-cf-saas/blocks": patch
"@tanstack-cf-saas/lint": patch
---

`add` no longer overwrites a file the project already has (such as its own `drizzle.config.ts`): it stops and names the paths. It also checks for name clashes before it copies anything, so a clash leaves no stray folder behind. A feature manifest may not list `.git` or `node_modules` in `files`.

`sync` and `check` treat CRLF and LF text as equal, so a Windows checkout is not reported stale. Each project made by `create` now gets its own rate-limit `namespace_id`s (they are account-wide on Cloudflare), and `sync` keeps the ones in `wrangler.jsonc`.

`harness check` exits 1 when files changed or are missing, and writes lock keys with `/` on Windows. `setup --var FOO` without `=` is an error. `setup` keeps the indent of `wrangler.jsonc`, and a space in the project path no longer breaks wrangler on Windows. The feature matrix fails on an unknown `--only`, and also removes and re-adds each feature and runs `cf-saas-blocks check` after each step.
