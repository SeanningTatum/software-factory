# Software Factory

[![check](https://github.com/SeanningTatum/software-factory/actions/workflows/check.yml/badge.svg?branch=staging)](https://github.com/SeanningTatum/software-factory/actions/workflows/check.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=SeanningTatum_tanstack-cf-saas-starter&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=SeanningTatum_tanstack-cf-saas-starter)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=SeanningTatum_tanstack-cf-saas-starter&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=SeanningTatum_tanstack-cf-saas-starter)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=SeanningTatum_tanstack-cf-saas-starter&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=SeanningTatum_tanstack-cf-saas-starter)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=SeanningTatum_tanstack-cf-saas-starter&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=SeanningTatum_tanstack-cf-saas-starter)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=SeanningTatum_tanstack-cf-saas-starter&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=SeanningTatum_tanstack-cf-saas-starter)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](apps/cli/package.json)

A software factory for Cloudflare Workers, made to be run with Claude Code. You compose a product
from blocks (a database, sign-in, billing, file uploads, background jobs). The factory wires them
together, tests them and deploys the result, and the same blocks, checks and workflows keep
working on the project after day one, for you and for a coding agent.

Today it makes one kind of product: a SaaS on [TanStack Start](https://tanstack.com/start).

```bash
npm install -g create-software-factory
create-software-factory my-saas
```

## How the factory works

| Part            | Here                                       | What it does                                                                                             |
| --------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Blocks          | Features, one folder each, with a manifest | A block names what it owns and what it needs, so it can be added or removed whole.                       |
| The line        | `create-software-factory`                  | Builds a project from the blocks you pick, adds or removes one later, and sets up Cloudflare.            |
| Inspection      | Lint rules, tests and the feature matrix   | Before a release, each block is built and checked alone and all together. Each project ships its own CI. |
| Agent workflows | `.claude/` in each project                 | Commands that take Claude through a job in steps and stop for you at each decision.                      |

## Why use it

- **You get only what you pick.** Each feature is one folder. A project made without billing has
  no billing code in it, not a switched-off copy.
- **You can change your mind.** `add billing` brings a feature in later, with the features it
  needs. `remove billing` takes out everything it owns.
- **It runs on your machine with no accounts.** The database, KV and file storage run locally
  through wrangler. Sign up, upload a file and click around before you own a Cloudflare account.
- **The wizard deploys it too.** Say yes and it creates the database and storage for staging and
  production, applies the migrations, saves your secrets and deploys both. It can also make the
  GitHub repository, with branch rules and the workflows that deploy on push.
- **The checks come with it.** Every feature ships with its tests. Lint, types, dead code, bundle
  size, a key scan and a dependency audit run in the CI the project ships with.
- **It is laid out for coding agents.** `FEATURES.md` maps the project, each feature keeps its own
  history, and a linter holds the code to the rules in `CLAUDE.md`.

## Install

You need [Node](https://nodejs.org) 20.19 or newer, [Bun](https://bun.sh) 1.4 or newer, and git.

Install the CLI once, with the tool you already use:

```bash
npm install -g create-software-factory
bun add -g create-software-factory
pnpm add -g create-software-factory
```

Then run `create-software-factory` in any folder. To update it, run the same install command again.

Or run it once without installing:

```bash
npm create software-factory@latest
bun create software-factory
pnpm create software-factory
```

Run through `npm create`, `pnpm create` or `bun create`, the wizard installs the project's packages
with that same tool. Run from a global install, it uses Bun; pass `--pm npm`, `--pm pnpm` or
`--pm yarn` to choose.

## Before you start

The wizard asks for these as it goes, and every one can be left empty. Gather them first and one
run deploys both environments, with staging working end to end. The Cloudflare token is set later
with `create-software-factory github` or `gh secret set CLOUDFLARE_API_TOKEN`; the rest with
`bun run setup`.

| What                                                                       | Needed for                        | Where to get it                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wrangler login`                                                           | Cloudflare setup                  | Run `bunx wrangler login` once on this machine.                                                                                                                                                                                                                                                                                                          |
| `gh auth login`                                                            | The GitHub repository and rules   | Install [`gh`](https://cli.github.com) and sign in.                                                                                                                                                                                                                                                                                                      |
| Cloudflare API token (`CLOUDFLARE_API_TOKEN`)                              | Deploys from GitHub Actions       | My Profile → API Tokens → the "Edit Cloudflare Workers" template, plus Account → D1 → Edit with `db`. For gradual rollouts on your own domain, also Zone → Zone → Read and Zone → Transform Rules → Edit.                                                                                                                                                |
| PostHog: two project API keys (`phc_…`), or one personal API key (`phx_…`) | Analytics in PostHog (optional)   | Either make two projects, such as `my-app-staging` and `my-app`, and copy each one's key from Project settings, or give a personal API key with the `project:write` scope and the wizard makes both. The personal key is used once and never saved. US or EU is in the address bar: `eu.posthog.com` is EU, `us.posthog.com` or `app.posthog.com` is US. |
| Stripe secret key and Pro price id                                         | `billing`                         | [API keys](https://dashboard.stripe.com/apikeys) and [Products](https://dashboard.stripe.com/products). Use test keys: what you type here goes to staging only.                                                                                                                                                                                          |
| Stripe webhook signing secret                                              | `billing`, after the first deploy | [Webhooks](https://dashboard.stripe.com/webhooks), pointed at `<APP_URL>/api/auth/stripe/webhook`. It needs the deployed URL, so leave it empty in the wizard.                                                                                                                                                                                           |

Production's own Stripe keys, a real Turnstile secret, a Sentry DSN and an alert webhook are for
later: `bun run setup --env production` asks for each one it doesn't have. Production's own Pro
price id is a setting, not a key, so pass it: `--var STRIPE_PRICE_PRO=price_…`. GitHub Actions
needs two of these keys in its own secrets too: `POSTHOG_KEY`, so each deploy reports to PostHog,
and `ALERT_WEBHOOK_URL`, so a failed production deploy posts there. Set them with `gh secret set`.
On PostHog's EU cloud, also run `gh variable set POSTHOG_HOST --body https://eu.i.posthog.com`.

## The wizard

Run it with no arguments and it asks five things. Every one has a default, so Enter works all the
way down.

```
┌   create-software-factory
│
◇  Where should the project go?
│  my-saas
│
◇  Project name
│  my-saas
│
◆  Features (the required ones are always on)
│  ◼ D1 database (Cloudflare D1 (SQLite) through Drizzle, as an Effect Database service, with real-SQL tests.)
│  ◻ KV
│  ◼ Auth (needs db)
│  ◻ Billing
│  ◻ Email (Transactional email through Cloudflare Email Service…)
│  ◻ R2 uploads
│  ◻ Workflows
│  ↑/↓ to navigate • Space: select • Enter: confirm
└
```

After the features it asks about the Claude workflows, the commit hooks and the GitHub workflows,
then builds the
project: it copies the template, installs packages, writes the first migration, applies it to the
local database, and makes the first commit.

```
◇  Add the Claude workflows (.claude/)?
│  Yes
│
◇  Add husky commit hooks (conventional messages, small commits)?
│  Yes
│
◇  Add the GitHub workflows and branch rules (.github/: CI, deploys, the promote button)?
│  Yes
│
◇  Created my-saas with db, auth
│
◆  Set up Cloudflare now? Creates the database and storage for staging and production, migrates
│  them, saves your secrets and deploys both (a few minutes).
│  ○ Yes / ● No
│
◆  Create a GitHub repository with branch rules? staging is the default branch; production moves
│  only to a commit of staging, and deploys it once tagged.
│  ○ Yes, private (rules on a private repository need a paid GitHub plan)
│  ○ Yes, public
│  ● Not now (run `create-software-factory github` later)
│
◇  Next ────────────────────╮
│                           │
│  cd /Users/you/my-saas    │
│  bun run dev              │
│                           │
├───────────────────────────╯
│
└  When you're ready to deploy: bun run setup
```

Both offers can wait. Answer no, and the app still runs at http://localhost:3000 with a local
database. Cloudflare setup needs you logged in to wrangler, and the GitHub step needs the
[`gh`](https://cli.github.com) CLI; without them the wizard says so and moves on.

A feature that needs keys you don't have yet, such as Stripe for billing, asks for them and takes
an empty answer. The feature stays off until you fill them in `.dev.vars`.

It also asks for two PostHog project API keys (`phc_…`), one for staging and one for production,
and their cloud, US or EU. A personal API key (`phx_…`) in place of staging's makes both projects
for you. Give them and both environments send analytics to PostHog, each to its
own project: Cloudflare setup uploads each key to its Worker. `dev` keeps staging's key but stays
on the console. Leave production's empty to share staging's project, and staging's empty to keep
the console everywhere.

### Skip the questions

```bash
create-software-factory my-saas --features db,auth,uploads --yes
```

| Flag                        | What it does                                             |
| --------------------------- | -------------------------------------------------------- |
| `--features db,auth`        | The features to add. Empty means the required ones only. |
| `--yes`                     | Take the defaults and ask nothing.                       |
| `--name my-saas`            | The project name, if it differs from the folder.         |
| `--pm bun`                  | The package manager: `bun`, `pnpm`, `npm` or `yarn`.     |
| `--no-claude`, `--no-husky` | Leave out the Claude workflows or the commit hooks.      |
| `--no-github`               | Leave out `.github/`: CI, deploys and the branch rules.  |
| `--no-install`, `--no-git`  | Don't install packages, or don't make a git repository.  |

`create-software-factory --help` lists every command.

## The building blocks

Every project gets the home page and health check, the UI components, the cookie consent banner,
analytics, and logging with error reports. You choose the rest:

| Feature     | What you get                                                               | Needs  |
| ----------- | -------------------------------------------------------------------------- | ------ |
| `db`        | A Cloudflare D1 database through Drizzle, with tests that run real SQL.    |        |
| `auth`      | Email and password sign-in with Better Auth, sessions, and rate limits.    | `db`   |
| `billing`   | Stripe subscriptions: checkout, the customer portal and webhooks.          | `auth` |
| `uploads`   | Per-user file uploads to R2, checked for size and type, with a rate limit. | `auth` |
| `email`     | Transactional email through Cloudflare Email Service, with no API key.     |        |
| `kv`        | A Workers KV store behind a typed service, with a read-through cache.      |        |
| `workflows` | A durable onboarding flow on Cloudflare Workflows.                         |        |

Ask for `billing` and you get `auth` and `db` with it. Choose `auth` and `email` together and auth
also verifies each new address with a mailed code, resets passwords by code and offers sign-in by
code (the `auth-email` feature, which you never pick: it is on whenever both are). With `auth`
alone there is no password reset; the wizard says so, and `add email` brings it later.

## After the project exists

Run these inside the project. It keeps its own copy of the CLI, so they need no global install:

```bash
bunx create-software-factory add billing      # add a feature and what it needs
bunx create-software-factory remove uploads   # remove a feature and everything it owns
bun run setup                                 # create the Cloudflare side and deploy
bun run setup --check                         # list what is still missing
bunx create-software-factory github           # the repository, branch rules, deploy settings, setup issues
```

The project's own `README.md` covers the rest: migrations, deploys and the two-branch release flow.

## Work on this repo

This is a monorepo: the template, the CLI that builds projects from it, and the packages both use.

| Path                      | What it is                                                                       |
| ------------------------- | -------------------------------------------------------------------------------- |
| `templates/saas-starter/` | The template, with every feature on. Start with its `FEATURES.md`.               |
| `apps/cli/`               | `create-software-factory`                                                        |
| `packages/`               | Shared lint rules, TypeScript presets, and the tool that wires features together |
| `claude/`                 | The Claude workflows the CLI ships to each project                               |

```bash
bun install
```

### Run the template

```bash
cd templates/saas-starter
cp .dev.vars.example .dev.vars
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .dev.vars
bun run db:migrate:local
bun run dev
```

Open http://localhost:3000. Sign up with any email and password; it all stays in a local database
under `.wrangler/`. Billing shows a setup hint until you add Stripe test keys to `.dev.vars`.

### Check your changes

```bash
bun run check        # lint, typecheck, unit tests and build, everywhere
```

From `templates/saas-starter`:

```bash
bun run test         # unit tests
bun run test:e2e     # Playwright; first run: bunx playwright install chromium
```

After a change to the template, prove every feature combination still works:

```bash
bun run --filter create-software-factory test:matrix
```

### Try your copy of the CLI

```bash
bun run try
```

This builds the CLI from this repo, runs the real wizard, and creates a project in
`../software-factory-try` with a first commit. Run it again and it replaces that folder. To skip the
questions, or pick the folder:

```bash
bun run try --features db,auth,uploads --yes
bun run try ../my-app --features db,auth
```

Why a script: a new project depends on the `@seanningtatum/software-factory-*` packages. `bun run try` packs them
from this repo and points the new project at those files, so the project runs your changes and not
the versions on npm. A project made this way is for trying things, not for shipping.

How the template scores against its goals is in [SCORECARD.md](SCORECARD.md). Open work is in
[BACKLOG.md](BACKLOG.md). The code rules are in `CLAUDE.md` here and in
`templates/saas-starter/CLAUDE.md`.
