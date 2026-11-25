---
"create-tanstack-cf-saas": patch
---

Cap request bodies at 1 MB, rate limit the Stripe endpoints and sign-in per account and IPv6 /64, undo a half-finished sign-up, and record a retried Stripe webhook once.
