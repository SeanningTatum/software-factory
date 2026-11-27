---
"create-tanstack-cf-saas": minor
---

`github` (and the wizard's GitHub step) opens one issue, labelled `setup`, for each setup step no command can do or check, such as onboarding the email sending domain or adding the Stripe webhook. An issue is opened once: a step that already has one, open or closed, is skipped when the command runs again. `create` now heads those steps "Still to do by hand before you go live".
