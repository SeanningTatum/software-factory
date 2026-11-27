---
"@tanstack-cf-saas/lint": minor
---

New rule `no-inline-handler`: a JSX prop takes a named function (`onClick={signOut}`), not an inline one (`onClick={() => signOut()}`). Tests are exempt.
