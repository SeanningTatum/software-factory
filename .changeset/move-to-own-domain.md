---
"create-tanstack-cf-saas": minor
---

A project moves to its own domain in one run. At a terminal, `setup` asks for the URL of each environment that has none or is on `workers.dev`. It deploys under a new one, sets `STAGING_URL` or `PRODUCTION_URL` on GitHub, and ends by naming the `wrangler.jsonc` commit. `create` and `setup` list the move under Next while production is on `workers.dev`. New projects' `promote.yml` and `deploy.yml` refuse to tag or migrate while a URL variable and its `APP_URL` in `wrangler.jsonc` differ, and `docs/branches.md` gains "Move to your own domain".
