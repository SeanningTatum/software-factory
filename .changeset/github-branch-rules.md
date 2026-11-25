---
"create-tanstack-cf-saas": minor
---

`create` now offers to set up Cloudflare for staging and production (resources, migrations, secrets, each environment's URL) and then GitHub, in that order, so the first push to `staging` deploys.

New `github` command, also offered at the end of `create`: it creates the GitHub repository when there is none, pushes `staging` (now the first branch of a new project, and the default) and `production`, and applies the rulesets in `.github/rulesets/`. Run in a project, it also sets what `deploy.yml` reads: the variables `CLOUDFLARE_ACCOUNT_ID` (from wrangler's login), `STAGING_URL` and `PRODUCTION_URL` (each environment's `APP_URL`), and the secret `CLOUDFLARE_API_TOKEN`, which it asks for. Both branches take pull requests only and require CI's checks; `production` also takes only a merge from `staging` whose last commit has a `v*` tag and has passed its own staging deploy.

The template's workflows follow the same model. `deploy.yml` deploys staging on a push to `staging` and production on a push to `production`. `ci.yml` runs the full checks on pull requests into either branch; the new `pr.yml` runs lint, types, unit tests and the key scan on a pull request stacked on any other branch; `promote.yml` is the tag gate. `docs/branches.md` draws the flow.
