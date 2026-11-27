---
"create-software-factory": minor
"@software-factory/blocks": minor
"@software-factory/lint": minor
"@software-factory/biome-config": minor
"@software-factory/tsconfig": minor
---

Renamed from `create-software-factory` and `@software-factory/*`. The bins are now
`software-factory-blocks` and `software-factory-lint`, and a project's config files are
`software-factory.json` and `software-factory-lint.json`. A project made with the old names must
rename those two files and its dependencies by hand.
