# Backlog

Open work, in the order we would do it. One item is one change someone can finish and check.

## How to add an item

Copy this block to the right section, give it the next free id, and add a row to the table.

```markdown
### B-00 · Short title that says the outcome

- **Area:** a row from SCORECARD.md, or "Features", or "Repo"
- **Size:** S (under an hour), M (half a day), L (more)
- **Needs you:** no, or what only the owner can do

**Why:** The problem in one or two plain sentences. Say who it hurts and how.

**Done when:**

- [ ] A result someone can check: a command that passes, a page that shows something.
- [ ] The test or gate that keeps it true.

**Where:** The files or folders to start in.
```

Rules for a good item:

- The title is the outcome, not the task: "Server functions refuse cross-site calls", not "Add CSRF".
- "Why" is for a reader who has never seen the code.
- Every "Done when" line can be ticked by running or looking at something.
- When an item is done, delete it here and update its row in `SCORECARD.md` in the same change.

## At a glance

| Id   | Title                                             | Area              | Size | Needs you             |
| ---- | ------------------------------------------------- | ----------------- | ---- | --------------------- |
| B-01 | CI runs on GitHub                                 | Repo              | S    | Fix Actions billing   |
| B-03 | The health check and Stripe keys agree            | Deployment        | S    | A decision            |
| B-06 | Every route has a working and a failing spec      | Testing           | M    | no                    |
| B-07 | Billing works with real Stripe test keys          | Features          | M    | Stripe test keys      |
| B-08 | The Claude workflows are the real repo            | Agentic workflows | S    | The repo URL          |
| B-09 | A first deploy to staging succeeds                | Deployment        | M    | A Cloudflare token    |
| B-10 | The packages are on npm                           | Repo              | S    | Claim the npm scope   |
| B-13 | The website's browser specs run                   | Testing           | S    | no                    |
| B-14 | The tools are proven on Windows                   | Quality checks    | S    | no                    |
| B-15 | Tests have coverage floors                        | Testing           | S    | no                    |
| B-16 | Pages are checked for accessibility               | Quality checks    | M    | no                    |
| B-18 | Sign-up is protected from bots                    | Security          | M    | Turnstile keys        |
| B-19 | Users can verify their email and reset a password | Features          | L    | Pick an email service |

## Now

### B-01 · CI runs on GitHub

- **Area:** Repo
- **Size:** S
- **Needs you:** Fix the payment or spending limit under GitHub Settings → Billing, or make the repo public

**Why:** GitHub refuses to start any job on this repo, so no workflow has ever run there. Every "passes" in this repo comes from a laptop.

**Done when:**

- [ ] `check`, `blocks` and `release` each finish on `main`.
- [ ] Any failure they show is fixed or has its own item here.

**Where:** `.github/workflows/`, and the Actions tab of the repo.

### B-03 · The health check and Stripe keys agree

- **Area:** Deployment
- **Size:** S
- **Needs you:** Decide: should a project with billing installed but no Stripe keys count as unhealthy?

**Why:** `/api/health` answers 503 on a fresh local setup, because billing marks its three Stripe settings as required. That is honest for production and confusing on day one.

**Done when:**

- [ ] The choice is written in the billing `TIMELINE.md`.
- [ ] `/api/health` and the README's first-run steps match it.

**Where:** `templates/saas-starter/src/features/billing/feature.json`, `src/features/home/routes/api/health.ts`.

## Next

### B-06 · Every route has a working and a failing spec

- **Area:** Testing
- **Size:** M
- **Needs you:** no

**Why:** Only flows with a state machine have browser specs. The dashboard, the health check and the API routes can break without a failing test.

**Done when:**

- [ ] Each page and API route has one spec for the normal case and one for an error.
- [ ] The test map fails when a new route has neither.

**Where:** `templates/saas-starter/src/features/*/e2e/`, `cf-saas-lint.json`.

### B-07 · Billing works with real Stripe test keys

- **Area:** Features
- **Size:** M
- **Needs you:** Stripe test keys and a test price id in `.dev.vars`

**Why:** Checkout, the customer portal and webhooks are written but have only ever shown the "not set up" hint. The webhook retry is covered by a unit test alone.

**Done when:**

- [ ] A test card upgrades a user to Pro and the billing page shows it.
- [ ] A cancelled subscription moves the user back to Free.
- [ ] The skipped Playwright spec "upgrading leaves for Stripe Checkout" runs and passes.

**Where:** `templates/saas-starter/src/features/billing/`.

### B-08 · The Claude workflows are the real repo

- **Area:** Agentic workflows
- **Size:** S
- **Needs you:** The git URL of the shared workflows repo

**Why:** `claude/` is a stand-in with three files. Four scorecard areas cannot move until the real one is in.

**Done when:**

- [ ] `claude/` is a git submodule of the shared repo.
- [ ] A new project gets those files in `.claude/` and `harness check` is clean.

**Where:** `claude/`, the steps in the root `CLAUDE.md`.

### B-09 · A first deploy to staging succeeds

- **Area:** Deployment
- **Size:** M
- **Needs you:** A Cloudflare API token and account id as repo secrets

**Why:** The deploy pipeline and `setup` have never touched a real Cloudflare account. The Deployment score is a guess until they do.

**Done when:**

- [ ] `create-tanstack-cf-saas setup --env staging` creates the resources and a second run changes nothing.
- [ ] `deploy.yml` deploys to staging and its smoke test passes.

**Where:** `apps/cli/src/setup.ts`, `templates/saas-starter/.github/workflows/deploy.yml`.

### B-10 · The packages are on npm

- **Area:** Repo
- **Size:** S
- **Needs you:** Claim the `@tanstack-cf-saas` scope, and decide between an npm token and trusted publishing

**Why:** A project made by the CLI cannot install until the four packages are published. `bun run try` works round it with local files.

**Done when:**

- [ ] `bunx create-tanstack-cf-saas my-app` installs and runs with no local files.
- [ ] `release.yml` publishes on a merged changeset.

**Where:** `.github/workflows/release.yml`, `.changeset/`.

### B-13 · The website's browser specs run

- **Area:** Testing
- **Size:** S
- **Needs you:** no

**Why:** The website shares the template's specs but they have never been run there, and its landing page has none.

**Done when:**

- [ ] `bun run test:e2e` passes in `apps/website`.
- [ ] One spec loads `/` and `/docs`.

**Where:** `apps/website/`.

### B-14 · The tools are proven on Windows

- **Area:** Quality checks
- **Size:** S
- **Needs you:** no

**Why:** The path fixes for Windows have a unit test, but the tools have never run there.

**Done when:**

- [ ] `check.yml` runs the two packages' tests on `windows-latest`.

**Where:** `.github/workflows/check.yml`, `packages/`.

## Later

### B-15 · Tests have coverage floors

- **Area:** Testing
- **Size:** S
- **Needs you:** no

**Why:** A file can have a test that checks almost nothing.

**Done when:**

- [ ] `bun run test` fails when coverage of `src/app` or `src/features` falls under a set floor.

**Where:** `templates/saas-starter/vitest.config.ts`.

### B-16 · Pages are checked for accessibility

- **Area:** Quality checks
- **Size:** M
- **Needs you:** no

**Why:** Nothing tells us when a page cannot be used with a keyboard or a screen reader.

**Done when:**

- [ ] Each page spec runs an accessibility scan and fails on a serious problem.

**Where:** `templates/saas-starter/src/features/*/e2e/`.

### B-18 · Sign-up is protected from bots

- **Area:** Security
- **Size:** M
- **Needs you:** Cloudflare Turnstile keys

**Why:** The rate limit slows one address down. It does not stop a bot farm making accounts.

**Done when:**

- [ ] With keys set, sign-up needs a Turnstile token; without them, it works as today.

**Where:** `templates/saas-starter/src/features/auth/`.

### B-19 · Users can verify their email and reset a password

- **Area:** Features
- **Size:** L
- **Needs you:** Pick an email service and supply its key

**Why:** A user who forgets their password is locked out for good.

**Done when:**

- [ ] A new `email` module sends through the chosen service.
- [ ] Reset and verification work end to end in a browser spec.

**Where:** a new module under `templates/saas-starter/src/features/core/`, and `src/features/auth/`.
