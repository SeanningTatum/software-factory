---
"create-tanstack-cf-saas": minor
---

The template it ships now refuses server function calls from other sites (Start's CSRF middleware, server functions only); has `bun run size`, which fails when the `/` or `/login` page or the Worker grows past its budget in `size-budgets.json`; and its CI runs that, `bun audit` for high and critical holes, a gitleaks scan of each pull request's commits, and a check that fails when a schema change has no migration. A `.github/dependabot.yml` opens weekly update pull requests.

On a pull request into `main`, CI writes the size table into the pull request's description and rewrites it on each push.
