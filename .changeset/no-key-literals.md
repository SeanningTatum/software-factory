---
"create-tanstack-cf-saas": patch
---

The template no longer holds a literal Stripe test key. The redaction test used Stripe's public docs key, and GitHub's push protection refused the first push of every new public project because of it. The test now builds the value at run time.
