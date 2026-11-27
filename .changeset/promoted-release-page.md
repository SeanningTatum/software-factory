---
"create-tanstack-cf-saas": minor
---

In new projects, each promoted tag gets a GitHub release. Once the production smoke test has passed, and on a gradual rollout once the new version has its share, `deploy.yml` creates the release for the tag with GitHub's generated notes, which list the pull requests merged since the last release. A release that fails its smoke test gets none, and the next release's notes list its changes. Running the job again makes no second release. A release that cannot be created does not fail the deploy: the run shows a warning with the command to make it by hand. A gradual rollout that is backed out later keeps its release page. The production job now has `contents: write` for this, and its checkout no longer saves the job's token where the packages it installs could read it.
