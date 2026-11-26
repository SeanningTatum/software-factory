---
"create-tanstack-cf-saas": patch
---

On Windows, `create` no longer fails at its first commit: git and `gh` start without a shell, which had split a commit message at its spaces. Package scripts that `setup` runs through npm, pnpm or yarn now start there too.
