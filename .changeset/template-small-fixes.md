---
"create-tanstack-cf-saas": patch
---

Three small fixes to the template. The home page loses its "Get started" button, which linked to the page it was on. The machine check fails a `*.machine.ts` that exports no machine: one built inside an exported function used to skip every check. A new project pins `bun@1.4.4` in `packageManager`, as this repo does, so its CI and its owner run the same Bun; `create --pm pnpm` (or npm, yarn) leaves the pin out.
