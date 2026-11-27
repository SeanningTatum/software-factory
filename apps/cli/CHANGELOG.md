# @seanningtatum/create-software-factory

## 0.4.0

### Minor Changes

- a1fdbf2: Renamed from `create-tanstack-cf-saas` and `@tanstack-cf-saas/*`: the CLI is `@seanningtatum/create-software-factory` (command `create-software-factory`) and
  the packages are `@seanningtatum/software-factory-*`. The bins are now
  `software-factory-blocks` and `software-factory-lint`, and a project's config files are
  `software-factory.json` and `software-factory-lint.json`. A project made with the old names must
  rename those two files and its dependencies by hand.

### Patch Changes

- ef09dc6: `add` works in a project that has features of its own; it threw `Unknown feature` for any name the template lacks. `setup --var` refuses a key a feature declares as a secret, because a var is written to the committed `wrangler.jsonc`. A personal PostHog key is masked as it is typed. A refused commit of `wrangler.jsonc` at the end of the wizard's Cloudflare step is now a warning, so `create` still says what it made. Edits to a `wrangler.jsonc` that opens with a `/** */` comment keep the file's indent. Generated files and lint output sort by code unit, so they no longer change with the machine's locale. `@seanningtatum/software-factory-lint` exports `byCodeUnit`.

## 0.3.0

### Minor Changes

- 254eaf1: `github` (and the wizard's GitHub step) opens one issue, labelled `setup`, for each setup step no command can do or check, such as onboarding the email sending domain or adding the Stripe webhook. An issue is opened once: a step that already has one, open or closed, is skipped when the command runs again. `create` now heads those steps "Still to do by hand before you go live".
- 798ee27: New projects get their first workflow block: `/foundation` interviews the founder about the product, the persona, goals and anti-goals, runs the `product-foundation` workflow to draft the document and find what is vague, puts those questions back to the founder, and writes `docs/product/FOUNDATION.md` only after a yes. Later UI, UX and product workflows read that file first. The same yes puts the product sentence at the top of the README, and `create` ends by pointing to `/foundation`.
- 254eaf1: A new optional `email` module sends transactional mail through Cloudflare Email Service's `send_email` binding, with no API key; `wrangler dev` simulates it. Choose it with `auth` and you also get the `auth-email` feature: a mailed 8-digit code, in a shared React Email layout (`email-templates`: `MailLayout` and `renderMail`, for your own mails too), verifies each new address before its first sign-in, resets a forgotten password (`/forgot-password`) and signs in without one (`/sign-in-code`). `auth-email` is never listed: it is on whenever both are, `add email` brings it to a project that has auth, and `remove email` takes it out. `create` warns when auth is chosen without email, since auth alone has no password reset.

### Patch Changes

- d129ac5: The template's `/api/health` spec decides by the project: with a `drizzle.config.ts` the response must report the database as up, and without one it must not report it. A lost `DB` binding now fails the spec.
- 504990d: The template passes the `no-comment` rule again: the email and auth files that keep their comments open with `// cf-saas-lint allow comments`.

## 0.2.1

### Patch Changes

- e0e4954: Publish under a new version: npm never takes 0.2.0 again after its unpublish.

## 0.2.0

### Minor Changes

- 1be7f2d: `create` asks whether to add the GitHub workflows and branch rules, and `--no-github` leaves them out: the project then has no `.github/`, no `docs/branches.md`, and the wizard makes no repository offer. New projects that keep them also get a promote button, as this repo has: Actions → promote → Run workflow tags `staging`'s tip, moves `production` to it in one push, and starts `deploy.yml` on `production`, which now also runs when started by hand.
- 88c7d38: `create` takes a PostHog personal API key (`phx_…`, scope `project:write`) in place of staging's project key, and makes `<name>-staging` and `<name>` through PostHog's API, so no PostHog key is copied by hand. The personal key is used once and never saved. If PostHog refuses a project, the wizard asks for that project's key instead. New projects' `/api/health` adds a warning, without failing, when `ANALYTICS_PROVIDER` names a provider whose key or binding is missing.
- ebfcc5b: `create` asks for two PostHog project API keys, one for staging and one for production, and their cloud (US or EU). With them, both environments send analytics to PostHog, each to its own project, and Cloudflare setup uploads each key to its Worker; `dev` stays on the console. Leaving production's key empty shares staging's project. When Cloudflare setup is skipped, `create` now also prints each feature's manual steps, such as billing's Stripe webhook. The README gains a "Before you start" list of every key the wizard asks for.
- b5f5f47: The commit hook and the title check now require a scope: `fix(auth): ...` passes and `fix: ...` does not. The commits the CLI makes carry one too: `chore(scaffold)`, `feat(scaffold)` and `chore(setup)`.
- d05d6e7: New projects can release to a share of visitors. The promote button takes a `rollout` choice: `full`, as before, or `gradual` with a starting percent. A gradual deploy uploads the new version, smoke-tests it by id with no visitors on it, then gives it its share; a second button, Actions → rollout, raises the share, finishes at 100, or backs out. Each step writes the split to the run's summary. `/api/health` now names the Worker version that answered, PostHog events carry it as `app_version`, and with the `POSTHOG_KEY` repository secret each step posts a `deployment_rolled_out` event. A gradual rollout needs a custom domain and one Transform Rule, which `docs/branches.md` gives; `deploy.yml` refuses one on `workers.dev`.
- b4d92ae: The Claude harness turns on Cloudflare's skills plugin (`cloudflare/skills`) in each new project's `.claude/settings.json`, so Claude Code offers to install it when the folder is trusted. Run `create-tanstack-cf-saas harness sync` in an existing project to get it; a project that has edited its `settings.json` keeps its own, so add the `extraKnownMarketplaces` and `enabledPlugins` keys there by hand.
- 4a5b2d1: A project moves to its own domain in one run. At a terminal, `setup` asks for the URL of each environment that has none or is on `workers.dev`. It deploys under a new one, sets `STAGING_URL` or `PRODUCTION_URL` on GitHub, and ends by naming the `wrangler.jsonc` commit. `create` and `setup` list the move under Next while production is on `workers.dev`. New projects' `promote.yml` and `deploy.yml` refuse to tag or migrate while a URL variable and its `APP_URL` in `wrangler.jsonc` differ, and `docs/branches.md` gains "Move to your own domain".
- 6f6c91d: In new projects, each promoted tag gets a GitHub release. Once the production smoke test has passed, and on a gradual rollout once the new version has its share, `deploy.yml` creates the release for the tag with GitHub's generated notes, which list the pull requests merged since the last release. A release that fails its smoke test gets none, and the next release's notes list its changes. Running the job again makes no second release. A release that cannot be created does not fail the deploy: the run shows a warning with the command to make it by hand. A gradual rollout that is backed out later keeps its release page. The production job now has `contents: write` for this, and its checkout no longer saves the job's token where the packages it installs could read it.
- 9a6f6a2: New projects trace failures they used to lose. A failed onboarding workflow step now writes an Error line with a `step` field and reaches Sentry and the alert webhook, then still fails so Cloudflare retries it. A 4xx `request failed` line now names the error (`error: "NotFound"`) beside its status. `wrangler.jsonc` turns on Cloudflare traces, Issues and `redact_query_string`: production keeps one trace in ten, staging keeps all, and logs are never sampled. `docs/runbook.md` says where to find them and that stored traces are billed from 1 December 2026.

### Patch Changes

- 517a588: In the template, a stranger can no longer lock a user out of sign-in by spending the account's limit with wrong passwords. Past that limit, sign-in asks for a Turnstile check instead of answering 429, when Turnstile is set up; `/login` shows the check only then, and analytics records it as `sign_in_failed` with reason `challenged`. Without Turnstile keys it answers 429 as before.
- 03f7e2c: In the template, a late or retried Stripe event can no longer leave a subscription with a stale cancel flag or period end. After every subscription update the billing hook writes the status, the cancel flag, the cancel and end times and the period from what Stripe holds now; before, it put back the status alone, and only when that differed.
- d0f460a: The template gives Better Auth the `subscription` table, so a checkout or a Stripe webhook can store a plan; before, every subscription write failed. `cf-saas-blocks sync` writes `featureAuthTables` into `src/gen/auth-plugins.ts`: the tables of every feature that adds auth plugins, for Better Auth's database adapter.
- 9dbd52b: The template's workflows install with `--ignore-scripts`, so no dependency's install script runs in CI, and then run the project's own `postinstall` where a typecheck follows. They call `wrangler`, `vite` and `playwright` with `bun run`, which runs the version in the lockfile and never downloads another.
- 03f7e2c: `add` and `remove` take several names, with spaces or commas (`add kv workflows`, `add kv,workflows`); before, every name after the first was dropped and a comma list was refused. A rate limiter that `add` brings in gets a random namespace id, as in `create`: it used to get the manifest's fixed id (1001, 1002), which every project on one Cloudflare account then shared. `remove` warns that the next `db:generate` writes `DROP TABLE` for the feature's tables.
- 03f7e2c: When a program isn't installed, the CLI says so (`git … could not start: …`) in place of "exited with null". A global install, which no package manager launched, uses the first of bun, pnpm, npm and yarn found on the machine, where it used to assume bun. `setup` and `github` run only the project's own pinned wrangler: without it they stop and ask you to install packages, and no longer hand your Cloudflare login and secrets to whatever `npx --yes wrangler` downloads.
- 647cbf9: New projects' deploys show a link to the live site on GitHub: `deploy.yml` and `rollout.yml` give each environment its URL, so the repository's Deployments list and each run link to staging or production.
- 2cab190: The template keeps a comment only where an agent or a reader would otherwise change the code wrongly: 16 are left, down from 135. `/check` in the Claude harness holds new comments to the same test. Run `create-tanstack-cf-saas harness sync` in an existing project to get it.
- 1048754: The `/check` command in the Claude harness now has Claude review the comments a change adds: delete any that say what the code does, rename instead where a name can hold the fact, and keep only reasons the code can't show. Run `create-tanstack-cf-saas harness sync` in an existing project to get it.
- 9dbd52b: Seven regexes no longer backtrack on long input. The template's log redaction took seconds on a 200 kB line with no email in it; it now takes milliseconds. `create` collapses runs of dashes in a name taken from the folder. The template's `CardTitle` and `Label` pass their content and `htmlFor` through by name, so screen-reader checks can see them.
- eb3d778: Add three lint rules. `server-fn-placement`: a feature's `createServerFn` calls live in its `api/`,
  and pages import them. `no-repeated-api-path`: an `/api/` path is written in one file only, apart
  from the route's own `createFileRoute` call and tests. The template moves its page server functions
  into each feature's `api/loaders.ts` and its auth paths into `auth/constants.ts`.
  
  `no-restating-test`: a test whose every `expect` checks an imported constant against a literal
  fails, since it repeats the source. Projects list such declaration-only files in `testExempt`; the
  template now exempts `constants.ts`.
- eb3d778: Add three lint rules: `one-component-per-file` (a `.tsx` file declares one component),
  `class-placement` (no classes in React files or `components/`, none inside a function) and
  `error-placement` (error classes live in their feature's `errors.ts`, or `src/app/errors.ts` for the
  kernel). The template moves its error classes into each feature's `errors.ts` and splits `plan-card.tsx`.
- 9dbd52b: `test:matrix` refuses an out folder that holds files an earlier run did not leave, since a run wipes it. Packing uses the running `bun`, not whichever `bun` is first on `PATH`.
- b3fe0a0: In the template, a gradual release now pins visitors to one version and checks that it worked. Before it starts, `deploy.yml` makes the Transform Rule on the app's host through Cloudflare's API, when `CLOUDFLARE_API_TOKEN` holds Zone → Zone → Read and Zone → Transform Rules → Edit; without them it warns and leaves the rule to you. Once the new version has its share, `deploy.yml` calls `/api/health` a hundred times from the runner and backs out when two versions answer; before, a missing Transform Rule went unseen and a page could ask the other version for scripts it lacks. Staging's deploys are tagged `staging-` and the commit, so its analytics events carry that as `app_version`; before, they carried the version's id. Each production deploy's summary also gives the D1 restore command for the second before its migrations ran. The docs say how to move production to a custom domain, and that a release which changes a Workflow must go out `full`.
- 517a588: `setup` no longer replaces a deployed `BETTER_AUTH_SECRET`, which signed every user out, when `wrangler secret list` fails. Only a Worker that doesn't exist yet counts as having no secrets; any other failure stops setup before it uploads a secret to that environment, and says to run it again.
- 03f7e2c: Three small fixes to the template. The home page loses its "Get started" button, which linked to the page it was on. The machine check fails a `*.machine.ts` that exports no machine: one built inside an exported function used to skip every check. A new project pins `bun@1.4.4` in `packageManager`, as this repo does, so its CI and its owner run the same Bun; `create --pm pnpm` (or npm, yarn) leaves the pin out.
- 03f7e2c: The pull-request title check refuses `Merge …`, `Revert "…`, `fixup! …` and `squash! …`. The commit hook lets those through because git writes them itself, but a squashed pull request's title becomes the commit, so "Merge everything" used to pass. New projects get the same check.
- 03f7e2c: In the template, the file list is newest first on every page. An upload's key now starts with its time counted down, so R2's own key order is newest first; before, keys were random and each page was sorted alone. Files stored before this change keep their old keys and sort among the new ones in no useful order.
- d0f460a: On Windows, `create` no longer fails at its first commit: git and `gh` start without a shell, which had split a commit message at its spaces. Package scripts that `setup` runs through npm, pnpm or yarn now start there too.

## 0.1.0

### Minor Changes

- ea564bc: `create` asks whether to add husky commit hooks (`--no-husky` to skip; `--yes` adds them). A project that takes them gets `.husky/commit-msg`, which refuses a message that is not a conventional commit, and `.husky/pre-commit`, which refuses a commit that adds more than 400 lines of code (Markdown, lockfiles, `src/gen/` and `drizzle/` do not count). They are the hooks this repo commits under, and they turn on after the project's first commit. In a project with the hooks, `add` commits the feature it scaffolds by itself when the tree is clean, since that code is not the owner's writing and is far over the limit.

  The template's `staging` ruleset now allows squash merges only and requires a new `title` check, which holds a pull request's title to the same rule when the project has the hooks. `github` sets the repository to title a squash commit by its pull request, and Dependabot's titles start with `build(deps):`.
- New projects release by fast-forward: one push tags `staging`'s tip and moves `production` to it, so both branches share one head. `production` takes no pull requests, `promote.yml` is gone, and `deploy.yml` deploys production only at a tagged commit of `staging`.
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
