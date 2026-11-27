---
"create-tanstack-cf-saas": patch
---

The template's workflows install with `--ignore-scripts`, so no dependency's install script runs in CI, and then run the project's own `postinstall` where a typecheck follows. They call `wrangler`, `vite` and `playwright` with `bun run`, which runs the version in the lockfile and never downloads another.
