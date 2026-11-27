---
description: Run every gate the project has and fix what fails
---

Run `bun run check`. For each failure, fix the cause rather than loosening the rule, then run it again until it passes. If you changed a feature or a core module (`src/features/<name>/` or `src/features/core/<name>/`), make sure its `TIMELINE.md` has a new Decisions or History line. Never loosen the core rule to make a check pass: a core module holds components only, or services and helpers only; a module with both, or with a page, moves out of core.

Lint catches commented-out code, TODO markers and a comment repeated in two places, but not a comment that says what the code does. Before you finish, read every comment your change adds. Delete it if the code already says it. If it carries a fact a name could hold, rename the variable, function or test and delete it. Keep only a reason the code can't show: how an outside system behaves (Stripe, Cloudflare, Better Auth, the browser), a security or data-loss reason, or a known limit written as `shortcut: <limit>, <when to fix>`. Say each reason once, where it applies.
