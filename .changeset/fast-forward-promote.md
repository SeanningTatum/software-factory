---
"create-tanstack-cf-saas": minor
---

New projects release by fast-forward: one push tags `staging`'s tip and moves `production` to it, so both branches share one head. `production` takes no pull requests, `promote.yml` is gone, and `deploy.yml` deploys production only at a tagged commit of `staging`.
