---
"create-tanstack-cf-saas": minor
---

`create` asks whether to add the GitHub workflows and branch rules, and `--no-github` leaves them out: the project then has no `.github/`, no `docs/branches.md`, and the wizard makes no repository offer. New projects that keep them also get a promote button, as this repo has: Actions → promote → Run workflow tags `staging`'s tip, moves `production` to it in one push, and starts `deploy.yml` on `production`, which now also runs when started by hand.
