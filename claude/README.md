# claude (placeholder)

This folder stands in for the shared Claude workflows repo until it exists. Replace it with the
real repo as a git submodule:

```bash
git rm -r claude && git submodule add <git-url> claude
```

`create-tanstack-cf-saas` copies everything here except this README and `.git` into each new
project's `.claude/` folder, and moves a top-level `CLAUDE.md`, if there is one, to the project
root. It records the source commit and a hash per file in `harness.lock.json`.
