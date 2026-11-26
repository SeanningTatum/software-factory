# create-tanstack-cf-saas

## 0.2.0

### Minor Changes

- 33d05bf: `cf-saas-lint` adds the `rules-file` rule: it fails when `CLAUDE.md` runs past `maxRulesLines` (80 by default) or names something that is not there: a backticked path whose top folder exists but which does not, a `bun run` script missing from `package.json`, or a "rule `x`" that is not a rule.
  
  The template it ships now writes an `audit_log` row for every sign-up, sign-in (failed ones too), sign-out and plan change; posts the first error of a burst to an optional `ALERT_WEBHOOK_URL`; ships `docs/runbook.md`; ties a consented anonymous id to the user at sign-up and sign-in, and resets it at sign-out; and has each feature's `events.ts` export a `metric` that a test checks against the event catalog.
- cb0ef31: The template it ships now refuses server function calls from other sites (Start's CSRF middleware, server functions only); has `bun run size`, which fails when the `/` or `/login` page or the Worker grows past its budget in `size-budgets.json`; and its CI runs that, `bun audit` for high and critical holes, a gitleaks scan of each pull request's commits, and a check that fails when a schema change has no migration. A `.github/dependabot.yml` opens weekly update pull requests.
  
  On a pull request into `main`, CI writes the size table into the pull request's description and rewrites it on each push.
- 769aaff: Arrange projects by feature: `src/app/` is the kernel and each feature lives in `src/features/<name>/` with a `feature.json` and a `TIMELINE.md`. `d1` is now `db` and `r2` is now `uploads`. The CLI takes `--features` (`--blocks`, `d1` and `r2` still work), and a new project's timelines start with one History line. `cf-saas-lint` adds the `feature-layout` rule and the `timeline` gate.
  
  Add a `core` group. Core holds shared modules of one kind: components only, or services and helpers only. A module with both, or with a page, is a feature. `db`, `kv`, `observability`, `analytics` and `ui` move to `src/features/core/<name>/`; shared pure helpers (`outsideCall`, `binding`) live in `src/features/core/lib/`; `consent`, `home`, `auth`, `billing`, `uploads` and `workflows` stay in `src/features/<name>/`. Names stay flat, so `--features db,kv` and `remove kv` are unchanged.
  
  - Breaking: the manifest flag `"core": true` is now `"required": true`; `cf-saas-blocks` refuses a `feature.json` that still has `core` and says to rename it.
  - `@tanstack-cf-saas/blocks`: `loadManifests` reads both levels and returns `Feature` (a manifest plus its `dir`); adds `featureDir`, `isCoreModule`, `CORE_DIR`, `SHARED_LIB_DIR`, `SHARED_LIB`, `RESERVED_NAMES` and the `Features` type. `timelinePath` and `scanFeature` take a folder instead of a name. `FEATURES.md` groups core modules and features. `check` enforces the core import rules: nothing in core imports a feature outside it, `core/lib` imports only `src/app`.
  - `@tanstack-cf-saas/lint`: `feature-layout` holds each core module to one kind and `core/lib` to flat `.ts` files; the new `shared-lib` rule keeps services, layers and React out of `core/lib`. `featureLayout.core` configures it. `{feature}` in the test map and the timeline gate use the folder (`core/kv`). Glob braces may hold globs (`{*,core/*}`). Adds `placeOf` and `coreRule`.
  - `create-tanstack-cf-saas`: scaffold, prune, `add` and `remove` follow the two levels; the matrix's core-only combination is now called `required`.
- 7fe29b2: `create` now offers to set up Cloudflare for staging and production (resources, migrations, secrets, each environment's URL) and then GitHub, in that order, so the first push to `staging` deploys.
  
  New `github` command, also offered at the end of `create`: it creates the GitHub repository when there is none, pushes `staging` (now the first branch of a new project, and the default) and `production`, and applies the rulesets in `.github/rulesets/`. Run in a project, it also sets what `deploy.yml` reads: the variables `CLOUDFLARE_ACCOUNT_ID` (from wrangler's login), `STAGING_URL` and `PRODUCTION_URL` (each environment's `APP_URL`), and the secret `CLOUDFLARE_API_TOKEN`, which it asks for. Both branches take pull requests only and require CI's checks; `production` also takes only a merge from `staging` whose last commit has a `v*` tag and has passed its own staging deploy.
  
  The template's workflows follow the same model. `deploy.yml` deploys staging on a push to `staging` and production on a push to `production`. `ci.yml` runs the full checks on pull requests into either branch; the new `pr.yml` runs lint, types, unit tests and the key scan on a pull request stacked on any other branch; `promote.yml` is the tag gate. `docs/branches.md` draws the flow.
- 7fe29b2: Migrations are always named. The template's `db:generate` script now ends in `--name`, so `bun run db:generate add_invoices` writes `drizzle/0001_add_invoices.sql` and a run without a name fails instead of writing one of drizzle's random names. `create` names a new project's first migration `0000_init`.
- 0408a75: The test map now needs a browser spec for every route file: `e2e/<route>.route.spec.ts`, where `{route}` is the path under `routes/` with `/` as `.` and `$` dropped. A core module's routes take theirs in `home`. A map entry with `always: true` also applies to files in `testExempt`.
  
  The template it ships has a working and a failing browser spec for each page and API route, an axe scan in every page spec, coverage floors in `bun run test`, and a size budget for every page: `bun run size` now fails on a page with no budget.
- 89cca5d: `create` now asks for the settings a chosen feature can't work without (billing's Stripe keys and price), writes the answers into `.dev.vars`, and warns about any left empty. It then offers to save the secrets to Cloudflare with `wrangler secret put`, to staging or production. `--yes` skips all of it.
  
  - Breaking: auth signs in with email and password only. `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are gone; add a provider to `socialProviders` in `api/auth.ts` when you need one.
  - Breaking: workflows has no HTTP trigger. `/api/workflows/onboarding` and `WORKFLOWS_TRIGGER_TOKEN` are gone; start a run from server code with the `Onboarding` service, which reads the `ONBOARDING_WORKFLOW` binding.
- 7fe29b2: `create` and `setup` apply the migrations themselves. `create` migrates the local database after it generates `0000_init`, so `dev` works straight away. `setup` migrates the local database and each environment's database it sets up. The db feature no longer lists migrating as a step to do by hand.
  
  `setup`, and the Cloudflare step in `create`, now make the first deploy of each environment that has no URL yet. Nothing but a deploy says what an account's workers.dev subdomain is, so they read the address wrangler prints, record it as `APP_URL`, and deploy again under it. The wizard no longer has to ask for an address you could not know.
  
  The last line of `create` names `setup` only when something is left for it: Cloudflare was skipped or did not finish, or a required setting is still missing.
  
  An environment with its own domain is deployed once under the URL you give. If a deploy fails, its URL is taken back, so the next `setup` tries again. The ids of what was made are committed even when a deploy fails. `setup` skips migrating when the project has no migration yet.
  
  When both are deployed but Cloudflare lacks a secret you left out, such as the Turnstile key or the alert webhook, the last line of `create` names them and says to run `setup` again to upload them.
- 7fe29b2: A new project carries the CLI that made it as a dev dependency, with a `setup` script. After a clone and an install, `bun run setup` runs that copy: nothing is fetched, and the version that handles your keys is the one in the lockfile. `bunx create-tanstack-cf-saas add`, `remove`, `github` and `harness` run the same copy.
  
  The wizard's hints and the project's README now say `bun run setup`.
- 638d478: With `auth`, sign-up can need a Cloudflare Turnstile token. Set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` and `/signup` shows the widget and Better Auth refuses a sign-up without a valid token (400 with none, 403 when Cloudflare rejects it); leave them empty and sign-up works as before. `.dev.vars.example` carries Cloudflare's always-pass test keys, so dev and the browser specs run guarded; put real keys in at deploy. The production CSP gains `frame-src https://challenges.cloudflare.com`. `cf-saas-blocks` supports an `example` on a var or secret in `feature.json`, shown in `.dev.vars.example` in place of its deployed default.

### Patch Changes

- 9495429: Cap request bodies at 1 MB, rate limit the Stripe endpoints and sign-in per account and IPv6 /64, undo a half-finished sign-up, and record a retried Stripe webhook once.
- 9495429: Billing shows "Manage" for unpaid subscriptions; uploads cap files per user and list one page at a time.
- 9495429: Staging deploys now build for staging, so they stop overwriting production; deploy workflows time out, check the CSP nonce, and pin their actions by SHA.
- 9495429: `add` no longer overwrites a file the project already has (such as its own `drizzle.config.ts`): it stops and names the paths. It also checks for name clashes before it copies anything, so a clash leaves no stray folder behind. A feature manifest may not list `.git` or `node_modules` in `files`.
  
  `sync` and `check` treat CRLF and LF text as equal, so a Windows checkout is not reported stale. Each project made by `create` now gets its own rate-limit `namespace_id`s (they are account-wide on Cloudflare), and `sync` keeps the ones in `wrangler.jsonc`.
  
  `harness check` exits 1 when files changed or are missing, and writes lock keys with `/` on Windows. `setup --var FOO` without `=` is an error. `setup` keeps the indent of `wrangler.jsonc`, and a space in the project path no longer breaks wrangler on Windows. The feature matrix fails on an unknown `--only`, and also removes and re-adds each feature and runs `cf-saas-blocks check` after each step.
- ea3c253: Template fixes in auth and the kernel. An `APP_URL` without a scheme (`myapp.example.com`) now leaves auth unconfigured with a 503 naming `APP_URL (a full https:// URL)`, instead of making every route answer 500. Every 429 now carries a `retry-after` header. `request-password-reset` is off the rate-limited list until a reset sender is wired; auth's `TIMELINE.md` says what to wire before launch.
- 18c0507: Billing: a late or retried `customer.subscription.updated` webhook can no longer bring a canceled subscription back to active, because the update hook re-reads the status from Stripe and writes it back. `Billing.stateFor` now prefers the entitled subscription when a user has several live ones, instead of an arbitrary row.
- 675e4b9: `cf-saas-blocks` no longer loses work or half-applies a change:
  
  - `removeBlock` refuses a feature with uncommitted changes, or one outside a git repository, unless passed `{ force: true }`. `cf-saas-blocks remove <feature>` takes `--force`; the CLI's `remove --force` now passes it through instead of checking on its own.
  - `addBlock` checks the project can sync before it copies anything, so a broken `wrangler.jsonc` no longer leaves a half-added feature behind.
  - `loadManifests` throws `"X" is declared by both a and b` when two features declare the same var, secret, binding or workflow class, instead of generating code that doesn't compile.
  - A rate-limit binding's `namespace_id` must be digits; it used to become `"NaN"` in `wrangler.jsonc`.
- 7fe29b2: The template no longer holds a literal Stripe test key. The redaction test used Stripe's public docs key, and GitHub's push protection refused the first push of every new public project because of it. The test now builds the value at run time.
- 60d28cb: New lint rule `no-nested-yield`: a `yield*` may not sit inside another `yield*` in the same generator, in source or tests. Write `const uploads = yield* Uploads;` and then `yield* uploads.list(...)`, not `yield* (yield* Uploads).list(...)`. The template's routes, onboarding steps and tests are rewritten to match.
- 5c091fd: New projects start on TypeScript 7 and `@types/node` 26, and their CI and deploy workflows pin `actions/checkout` v7.0.1 and `actions/upload-artifact` v7.0.2.
- 2cf545a: The template's `TIMELINE.md` files ship in a starter state. A test fails when one has a History line, since only a project made from the template keeps a History. Decisions lines that no longer matched the code are fixed or gone, such as the ones about GitHub sign-in and the old `/api/health`.
