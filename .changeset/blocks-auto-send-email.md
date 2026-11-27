---
"@tanstack-cf-saas/blocks": minor
---

A `feature.json` can declare a `send_email` binding, which `sync` writes to `wrangler.jsonc` for both environments. A feature marked `"auto": true` is never chosen: `create`, `add` and `prune` turn it on whenever everything it requires is on, and `remove` takes it out along with either feature it needs.
