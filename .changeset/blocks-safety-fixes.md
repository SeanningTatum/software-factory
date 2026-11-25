---
"@tanstack-cf-saas/blocks": patch
"create-tanstack-cf-saas": patch
---

`cf-saas-blocks` no longer loses work or half-applies a change:

- `removeBlock` refuses a feature with uncommitted changes, or one outside a git repository, unless passed `{ force: true }`. `cf-saas-blocks remove <feature>` takes `--force`; the CLI's `remove --force` now passes it through instead of checking on its own.
- `addBlock` checks the project can sync before it copies anything, so a broken `wrangler.jsonc` no longer leaves a half-added feature behind.
- `loadManifests` throws `"X" is declared by both a and b` when two features declare the same var, secret, binding or workflow class, instead of generating code that doesn't compile.
- A rate-limit binding's `namespace_id` must be digits; it used to become `"NaN"` in `wrangler.jsonc`.
