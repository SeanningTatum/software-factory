---
"@tanstack-cf-saas/lint": minor
---

New rule `no-comment`: a file holds no comments unless it opens, before any code, with `// cf-saas-lint allow comments`. Tool directives (`biome-ignore`, `@ts-`, `/// <reference>`) are not comments. A file that allows them is still held to `no-useless-comment` and `no-duplicate-comment`. The line itself is refused in a file with no comments left. To adopt it, delete a file's comments or add that line at its top.
