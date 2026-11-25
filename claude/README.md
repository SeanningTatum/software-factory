# claude

The Claude harness that ships to new projects. It is a stand-in with three files until B-08.

`create-tanstack-cf-saas` copies everything here except this README into each new project's
`.claude/` folder, and moves a top-level `CLAUDE.md`, if there is one, to the project root. It
records a hash per file in `harness.lock.json`.
