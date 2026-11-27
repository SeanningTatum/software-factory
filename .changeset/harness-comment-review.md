---
"create-tanstack-cf-saas": patch
---

The `/check` command in the Claude harness now has Claude review the comments a change adds: delete any that say what the code does, rename instead where a name can hold the fact, and keep only reasons the code can't show. Run `create-tanstack-cf-saas harness sync` in an existing project to get it.
