---
"create-tanstack-cf-saas": patch
---

`setup` no longer replaces a deployed `BETTER_AUTH_SECRET`, which signed every user out, when `wrangler secret list` fails. Only a Worker that doesn't exist yet counts as having no secrets; any other failure stops setup before it uploads a secret to that environment, and says to run it again.
