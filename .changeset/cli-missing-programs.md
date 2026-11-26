---
"create-tanstack-cf-saas": patch
---

When a program isn't installed, the CLI says so (`git … could not start: …`) in place of "exited with null". A global install, which no package manager launched, uses the first of bun, pnpm, npm and yarn found on the machine, where it used to assume bun. `setup` and `github` run only the project's own pinned wrangler: without it they stop and ask you to install packages, and no longer hand your Cloudflare login and secrets to whatever `npx --yes wrangler` downloads.
