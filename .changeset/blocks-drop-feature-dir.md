---
"@tanstack-cf-saas/blocks": patch
---

Deletes `featureDir`, which nothing called. The 0.1.0 changelog lists it as added, but the package entry never exported it, so no import breaks.
