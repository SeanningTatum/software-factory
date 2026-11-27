---
"create-tanstack-cf-saas": minor
---

The Claude harness turns on Cloudflare's skills plugin (`cloudflare/skills`) in each new project's `.claude/settings.json`, so Claude Code offers to install it when the folder is trusted. Run `create-tanstack-cf-saas harness sync` in an existing project to get it; a project that has edited its `settings.json` keeps its own, so add the `extraKnownMarketplaces` and `enabledPlugins` keys there by hand.
