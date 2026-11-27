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

| Id   | Title                                                    | Area              | Size | Needs you           |
| ---- | -------------------------------------------------------- | ----------------- | ---- | ------------------- |
| B-03 | The health check and Stripe keys agree                   | Deployment        | S    | A decision          |
| B-07 | Billing works with real Stripe test keys                 | Features          | M    | Stripe test keys    |
| B-08 | New projects get a real Claude harness                   | Agentic workflows | S    | A decision          |
| B-10 | The packages are on npm                                  | Repo              | S    | Claim the npm scope |
| B-20 | software-factory-lint parses without a second TypeScript | Repo              | M    | no                  |
| B-21 | A stranger can't lock a user out of sign-in              | Security          | M    | A decision          |
| B-22 | A repeated Stripe event leaves one audit row             | Logging           | M    | no                  |
| B-24 | A live project moves to its own domain in one run        | Deployment        | M    | A custom domain     |
| B-25 | The kernel's body cap knows no feature's path            | Features          | S    | no                  |

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

**Why:** `claude/` is a stand-in. Four scorecard areas cannot move until a real one is in.

**Done when:**

- [ ] `claude/` holds the real harness as plain files, with no submodule.
- [ ] A new project gets those files in `.claude/` and `harness check` is clean.

**Where:** `claude/`, `apps/cli/scripts/bundle-template.ts`.

### B-10 · The packages are on npm

- **Area:** Repo
- **Size:** S
- **Needs you:** Claim the `@software-factory` scope, and decide between an npm token and trusted publishing

**Why:** A project made by the CLI cannot install until the four packages are published. `bun run try` works round it with local files.

**Done when:**

- [ ] `bunx create-software-factory my-app` installs and runs with no local files.
- [ ] `release.yml` publishes on a merged changeset.

**Where:** `.github/workflows/release.yml`, `.changeset/`.

## Later

### B-20 · software-factory-lint parses without a second TypeScript

- **Area:** Repo
- **Size:** M
- **Needs you:** no

**Why:** TypeScript 7 has no JS API, so `software-factory-lint` reads source through `@typescript/typescript6`. Every project installs a second full compiler just for lint, and that parser stays on TypeScript 6 syntax.

**Done when:**

- [ ] `packages/lint` parses with `oxc-parser` (already in the tree through knip) and no longer depends on `@typescript/typescript6`.
- [ ] `bun run --filter @software-factory/lint test` and `test:matrix` pass.

**Where:** `packages/lint/src/files.ts`, `lint.ts`, `rules/ast-rules.ts`, `rules/shared-lib.ts`, `rules/types.ts`.

### B-21 · A stranger can't lock a user out of sign-in

- **Area:** Security
- **Size:** M
- **Needs you:** Decide: a second, looser limiter for the account key, or a counter of failed sign-ins in KV or D1

**Why:** Sign-in is limited per account as well as per address, so that many addresses cannot guess one password. The same limit lets anyone who knows an email send ten bad sign-ins a minute and keep its owner out. Cloudflare's limiter counts and checks in one call, so it cannot count failures alone: counting after the password check would let a guesser try without limit.

**Done when:**

- [ ] The choice is written in the auth `TIMELINE.md`.
- [ ] A test shows the owner, with the right password, signing in while a stranger sends bad ones for the same email.
- [ ] A test shows that guesses at one account from many addresses are still stopped.

**Where:** `templates/saas-starter/src/features/auth/api/auth-service.ts` (`refuseIfLimited`), `src/features/auth/feature.json`.

### B-22 · A repeated Stripe event leaves one audit row

- **Area:** Logging
- **Size:** M
- **Needs you:** no

**Why:** When Stripe sends a checkout or a cancel event twice, the billing hooks run twice and `audit_log` gets two rows for one plan change. The hook is handed the row after the Stripe plugin has already written it, so it cannot tell a first delivery from a repeat.

**Done when:**

- [ ] Each Stripe event id is recorded once, and a repeat skips `onEvent`.
- [ ] A real-SQL test sends one event twice and finds one `audit_log` row.

**Where:** `templates/saas-starter/src/features/billing/auth-plugins.ts`, `src/features/billing/schema.ts`.

### B-24 · A live project moves to its own domain in one run

- **Area:** Deployment
- **Size:** M
- **Needs you:** A test project on `workers.dev` and a domain in Cloudflare to move it to

**Why:** The wizard asks for each environment's URL once, in `create`. A project that starts on `workers.dev` and gets a domain later has three places to change by hand: `APP_URL` in `wrangler.jsonc`, the `PRODUCTION_URL` variable on GitHub, and a commit so CI does not deploy the old one. Adding the domain in Cloudflare changes none of them. Miss one and GitHub links to the old address, the promote button refuses a gradual rollout as if the site were still on `workers.dev`, or the next deploy fails its smoke test and rolls back.

**Done when:**

- [ ] `create-software-factory setup`, run at a terminal in a project whose `APP_URL` is on `workers.dev`, asks for each environment's URL in the words `create` uses; a domain given there becomes that environment's `APP_URL` and the environment deploys under it.
- [ ] In a project with a GitHub repository, the same run sets `STAGING_URL` or `PRODUCTION_URL` to match: `gh variable list` shows the new URL, and the next deploy's link on GitHub goes to the domain.
- [ ] The run ends by saying `wrangler.jsonc` changed and must reach `staging` before the next promotion.
- [ ] `create` with production's URL left empty lists the domain under "Next": what it unlocks (gradual production rollouts), the one command to run once the domain exists, and the Transform Rule in `docs/branches.md`. With a domain given, the step is absent.
- [ ] On the test project: `/api/health` on the domain answers 200, a deploy from CI leaves the domain attached, and promote with `gradual` gets past the `workers.dev` check.
- [ ] `setup.test.ts`, `github.test.ts` and `create.machine.test.ts` hold the question, the variable, the closing line and the reminder.
- [ ] `docs/branches.md` has a short "Move to your own domain" section that names the one command.

**Where:** `apps/cli/src/commands.ts` (the URL question in the `create` wizard, the `setup` command, `deployInputs`), `apps/cli/src/setup.ts` (`firstDeploy`), `apps/cli/src/github.ts` (`setDeploySettings`), `templates/saas-starter/docs/branches.md`. Tracked as https://github.com/SeanningTatum/software-factory/issues/47.

### B-25 · The kernel's body cap knows no feature's path

- **Area:** Features
- **Size:** S
- **Needs you:** no

**Why:** `src/app/body.ts` raises the request size cap for paths under `/api/uploads`, so the kernel names an optional feature. Remove uploads and the branch stays behind; rename its route and uploads get the 1 MB cap.

**Done when:**

- [ ] A feature declares its own body cap (in `feature.json` or a contribution file) and `software-factory-blocks sync` writes it to `src/gen/`.
- [ ] `src/app/body.ts` reads the generated caps and no longer appears under `no-repeated-api-path` in `software-factory-lint.json`.

**Where:** `templates/saas-starter/src/app/body.ts`, `packages/blocks/src/generate.ts`.
