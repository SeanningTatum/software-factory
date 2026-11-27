---
"create-tanstack-cf-saas": patch
---

In the template, a stranger can no longer lock a user out of sign-in by spending the account's limit with wrong passwords. Past that limit, sign-in asks for a Turnstile check instead of answering 429, when Turnstile is set up; `/login` shows the check only then, and analytics records it as `sign_in_failed` with reason `challenged`. Without Turnstile keys it answers 429 as before.
