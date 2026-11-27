---
"@tanstack-cf-saas/lint": minor
---

Three new rules. `no-inline-handler`: a JSX prop takes a named function (`onClick={signOut}`), not an inline one; tests are exempt. `no-useless-comment`: no commented-out code, `TODO`/`FIXME` markers, divider lines or empty comments. `no-duplicate-comment`: the same comment of five words or more may appear only once across the linted files.
