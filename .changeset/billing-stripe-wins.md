---
"create-tanstack-cf-saas": patch
---

In the template, a late or retried Stripe event can no longer leave a subscription with a stale cancel flag or period end. After every subscription update the billing hook writes the status, the cancel flag, the cancel and end times and the period from what Stripe holds now; before, it put back the status alone, and only when that differed.
