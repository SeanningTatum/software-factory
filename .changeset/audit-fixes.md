---
"create-software-factory": patch
"@software-factory/blocks": patch
"@software-factory/lint": patch
---

`add` works in a project that has features of its own; it threw `Unknown feature` for any name the template lacks. `setup --var` refuses a key a feature declares as a secret, because a var is written to the committed `wrangler.jsonc`. A personal PostHog key is masked as it is typed. A refused commit of `wrangler.jsonc` at the end of the wizard's Cloudflare step is now a warning, so `create` still says what it made. Edits to a `wrangler.jsonc` that opens with a `/** */` comment keep the file's indent. Generated files and lint output sort by code unit, so they no longer change with the machine's locale. `@software-factory/lint` exports `byCodeUnit`.
