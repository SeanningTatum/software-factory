---
"create-tanstack-cf-saas": patch
---

Billing: a late or retried `customer.subscription.updated` webhook can no longer bring a canceled subscription back to active, because the update hook re-reads the status from Stripe and writes it back. `Billing.stateFor` now prefers the entitled subscription when a user has several live ones, instead of an arbitrary row.
