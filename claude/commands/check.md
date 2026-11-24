---
description: Run every gate the project has and fix what fails
---

Run `bun run check`. For each failure, fix the cause rather than loosening the rule, then run it again until it passes. If you changed a feature or a core module (`src/features/<name>/` or `src/features/core/<name>/`), make sure its `TIMELINE.md` has a new Decisions or History line. Never loosen the core rule to make a check pass: a core module holds components only, or services and helpers only; a module with both, or with a page, moves out of core.
