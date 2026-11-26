---
"create-tanstack-cf-saas": minor
---

New projects can release to a share of visitors. The promote button takes a `rollout` choice: `full`, as before, or `gradual` with a starting percent. A gradual deploy uploads the new version, smoke-tests it by id with no visitors on it, then gives it its share; a second button, Actions → rollout, raises the share, finishes at 100, or backs out. Each step writes the split to the run's summary. `/api/health` now names the Worker version that answered, PostHog events carry it as `app_version`, and with the `POSTHOG_KEY` repository secret each step posts a `deployment_rolled_out` event. A gradual rollout needs a custom domain and one Transform Rule, which `docs/branches.md` gives; `deploy.yml` refuses one on `workers.dev`.
