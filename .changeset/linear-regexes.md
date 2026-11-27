---
"create-tanstack-cf-saas": patch
"@tanstack-cf-saas/lint": patch
---

Seven regexes no longer backtrack on long input. The template's log redaction took seconds on a 200 kB line with no email in it; it now takes milliseconds. `create` collapses runs of dashes in a name taken from the folder. The template's `CardTitle` and `Label` pass their content and `htmlFor` through by name, so screen-reader checks can see them.
