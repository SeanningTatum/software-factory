---
"create-tanstack-cf-saas": patch
---

The pull-request title check refuses `Merge …`, `Revert "…`, `fixup! …` and `squash! …`. The commit hook lets those through because git writes them itself, but a squashed pull request's title becomes the commit, so "Merge everything" used to pass. New projects get the same check.
