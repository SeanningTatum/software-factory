---
"create-software-factory": minor
"@seanningtatum/software-factory-blocks": minor
"@seanningtatum/software-factory-lint": minor
"@seanningtatum/software-factory-biome-config": minor
"@seanningtatum/software-factory-tsconfig": minor
---

Renamed from `create-tanstack-cf-saas` and `@tanstack-cf-saas/*`: the CLI is `create-software-factory` and
the packages are `@seanningtatum/software-factory-*`. The bins are now
`software-factory-blocks` and `software-factory-lint`, and a project's config files are
`software-factory.json` and `software-factory-lint.json`. A project made with the old names must
rename those two files and its dependencies by hand.
