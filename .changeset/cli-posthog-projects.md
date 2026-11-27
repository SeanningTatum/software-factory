---
"create-tanstack-cf-saas": minor
---

`create` takes a PostHog personal API key (`phx_…`, scope `project:write`) in place of staging's project key, and makes `<name>-staging` and `<name>` through PostHog's API, so no PostHog key is copied by hand. The personal key is used once and never saved. If PostHog refuses a project, the wizard asks for that project's key instead. New projects' `/api/health` adds a warning, without failing, when `ANALYTICS_PROVIDER` names a provider whose key or binding is missing.
