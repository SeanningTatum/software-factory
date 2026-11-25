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
| B-03 | The health check and Stripe keys agree            | Deployment        | S    | A decision            |
| B-07 | Billing works with real Stripe test keys          | Features          | M    | Stripe test keys      |
| B-08 | New projects get a real Claude harness            | Agentic workflows | S    | A decision            |
| B-09 | A first deploy to staging succeeds                | Deployment        | M    | A Cloudflare token    |
| B-10 | The packages are on npm                           | Repo              | S    | Claim the npm scope   |
| B-19 | Users can verify their email and reset a password | Features          | L    | Pick an email service |
| B-20 | cf-saas-lint parses without a second TypeScript   | Repo              | M    | no                    |

## Now

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

### B-08 · New projects get a real Claude harness

- **Area:** Agentic workflows
- **Size:** S
- **Needs you:** A decision: which skills, agents and hooks ship

**Why:** `claude/` is a stand-in with three files. Four scorecard areas cannot move until a real one is in.

**Done when:**

- [ ] `claude/` holds the real harness as plain files, with no submodule.
- [ ] A new project gets those files in `.claude/` and `harness check` is clean.

**Where:** `claude/`, `apps/cli/scripts/bundle-template.ts`.

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

## Later

### B-19 · Users can verify their email and reset a password

- **Area:** Features
- **Size:** L
- **Needs you:** Pick an email service and supply its key

**Why:** A user who forgets their password is locked out for good.

**Done when:**

- [ ] A new `email` module sends through the chosen service.
- [ ] Reset and verification work end to end in a browser spec.

**Where:** a new module under `templates/saas-starter/src/features/core/`, and `src/features/auth/`.

### B-20 · cf-saas-lint parses without a second TypeScript

- **Area:** Repo
- **Size:** M
- **Needs you:** no

**Why:** TypeScript 7 has no JS API, so `cf-saas-lint` reads source through `@typescript/typescript6`. Every project installs a second full compiler just for lint, and that parser stays on TypeScript 6 syntax.

**Done when:**

- [ ] `packages/lint` parses with `oxc-parser` (already in the tree through knip) and no longer depends on `@typescript/typescript6`.
- [ ] `bun run --filter @tanstack-cf-saas/lint test` and `test:matrix` pass.

**Where:** `packages/lint/src/files.ts`, `lint.ts`, `rules/ast-rules.ts`, `rules/shared-lib.ts`, `rules/types.ts`.
