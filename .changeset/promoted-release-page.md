---
"create-tanstack-cf-saas": minor
---

In new projects, each promoted tag gets a GitHub release. Once the production smoke test has passed, and on a gradual rollout once the new version has its share, `deploy.yml` creates the release for the tag with GitHub's generated notes, which list the pull requests merged since the last tag. A release that fails its smoke test gets none. Running the job again makes no second release, and a release that cannot be created does not fail the deploy. A gradual rollout that is backed out later keeps its release page. The production job now has `contents: write` for this.
