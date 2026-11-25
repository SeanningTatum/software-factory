---
"create-tanstack-cf-saas": minor
---

A new project carries the CLI that made it as a dev dependency, with a `setup` script. After a clone and an install, `bun run setup` runs that copy: nothing is fetched, and the version that handles your keys is the one in the lockfile. `bunx create-tanstack-cf-saas add`, `remove`, `github` and `harness` run the same copy.

The wizard's hints and the project's README now say `bun run setup`.
