---
"create-tanstack-cf-saas": minor
---

New `github` command, also offered at the end of `create`: it creates the GitHub repository when there is none, pushes `staging` (now the first branch of a new project, and the default) and `production`, and applies the rulesets in `.github/rulesets/`. Both branches take pull requests only and require CI's checks; `production` also takes only a merge from `staging` whose last commit has a `v*` tag and has passed its own staging deploy.

The template's workflows follow the same model. `deploy.yml` deploys staging on a push to `staging` and production on a push to `production`. `ci.yml` runs the full checks on pull requests into either branch; the new `pr.yml` runs lint, types, unit tests and the key scan on a pull request stacked on any other branch; `promote.yml` is the tag gate. `docs/branches.md` draws the flow.
