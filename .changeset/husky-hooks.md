---
"create-tanstack-cf-saas": minor
---

`create` asks whether to add husky commit hooks (`--no-husky` to skip; `--yes` adds them). A project that takes them gets `.husky/commit-msg`, which refuses a message that is not a conventional commit, and `.husky/pre-commit`, which refuses a commit that adds more than 400 lines of code (Markdown, lockfiles, `src/gen/` and `drizzle/` do not count). They are the hooks this repo commits under, and they turn on after the project's first commit. In a project with the hooks, `add` commits the feature it scaffolds by itself when the tree is clean, since that code is not the owner's writing and is far over the limit.

The template's `staging` ruleset now allows squash merges only and requires a new `title` check, which holds a pull request's title to the same rule when the project has the hooks. `github` sets the repository to title a squash commit by its pull request, and Dependabot's titles start with `build(deps):`.
