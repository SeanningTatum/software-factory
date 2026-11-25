---
"create-tanstack-cf-saas": minor
---

`create` and `setup` apply the migrations themselves. `create` migrates the local database after it generates `0000_init`, so `dev` works straight away. `setup` migrates the local database and each environment's database it sets up. The db feature no longer lists migrating as a step to do by hand.

`setup`, and the Cloudflare step in `create`, now make the first deploy of each environment that has no URL yet. Nothing but a deploy says what an account's workers.dev subdomain is, so they read the address wrangler prints, record it as `APP_URL`, and deploy again under it. The wizard no longer has to ask for an address you could not know.

The last line of `create` names `setup` only when something is left for it: Cloudflare was skipped or did not finish, or a required setting is still missing.

An environment with its own domain is deployed once under the URL you give. If a deploy fails, its URL is taken back, so the next `setup` tries again. The ids of what was made are committed even when a deploy fails. `setup` skips migrating when the project has no migration yet.

When both are deployed but Cloudflare lacks a secret you left out, such as the Turnstile key or the alert webhook, the last line of `create` names them and says to run `setup` again to upload them.
