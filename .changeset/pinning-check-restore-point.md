---
"create-tanstack-cf-saas": patch
---

In the template, a gradual release now pins visitors to one version and checks that it worked. Before it starts, `deploy.yml` makes the Transform Rule on the app's host through Cloudflare's API, when `CLOUDFLARE_API_TOKEN` holds Zone → Zone → Read and Zone → Transform Rules → Edit; without them it warns and leaves the rule to you. Once the new version has its share, `deploy.yml` calls `/api/health` a hundred times from the runner and backs out when two versions answer; before, a missing Transform Rule went unseen and a page could ask the other version for scripts it lacks. Staging's deploys are tagged `staging-` and the commit, so its analytics events carry that as `app_version`; before, they carried the version's id. Each production deploy's summary also gives the D1 restore command for the second before its migrations ran. The docs say how to move production to a custom domain, and that a release which changes a Workflow must go out `full`.
