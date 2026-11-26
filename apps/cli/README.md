# create-tanstack-cf-saas

Build a SaaS on Cloudflare from building blocks. One command asks what your product needs (a
database, sign-in, billing, file uploads, background jobs) and hands you a working
[TanStack Start](https://tanstack.com/start) app with those parts wired together, tested, and ready
to deploy to Cloudflare Workers.

## Install

You need Node 20.19 or newer, [Bun](https://bun.sh) 1.4 or newer, and git.

```bash
npm install -g create-tanstack-cf-saas
bun add -g create-tanstack-cf-saas
pnpm add -g create-tanstack-cf-saas
```

Then, in any folder:

```bash
create-tanstack-cf-saas my-saas
```

Or run it once without installing: `npm create tanstack-cf-saas@latest`,
`bun create tanstack-cf-saas` or `pnpm create tanstack-cf-saas`.

## What it asks

Where the project goes, its name, and which features you want. Then it copies the template,
installs packages, sets up a local database and makes the first commit. It offers to create the
Cloudflare side for staging and production and a GitHub repository with branch rules; both can
wait. To skip the questions:

```bash
create-tanstack-cf-saas my-saas --features db,auth,uploads --yes
```

## Features

Every project gets the home page and health check, the UI components, the cookie consent banner,
analytics, and logging with error reports. You choose the rest:

| Feature     | What you get                                                               | Needs  |
| ----------- | -------------------------------------------------------------------------- | ------ |
| `db`        | A Cloudflare D1 database through Drizzle, with tests that run real SQL.    |        |
| `auth`      | Email and password sign-in with Better Auth, sessions, and rate limits.    | `db`   |
| `billing`   | Stripe subscriptions: checkout, the customer portal and webhooks.          | `auth` |
| `uploads`   | Per-user file uploads to R2, checked for size and type, with a rate limit. | `auth` |
| `kv`        | A Workers KV store behind a typed service, with a read-through cache.      |        |
| `workflows` | A durable onboarding flow on Cloudflare Workflows.                         |        |

## Commands

| Command                 | What it does                                                       |
| ----------------------- | ------------------------------------------------------------------ |
| `create [dir]`          | Create a project. The default: `create-tanstack-cf-saas my-saas`.  |
| `add <feature>`         | Add a feature, and the features it needs, to this project.         |
| `remove <feature>`      | Remove a feature and everything it owns.                           |
| `setup`                 | Create the Cloudflare resources, migrate, set secrets and deploy.  |
| `github`                | Put the project on GitHub with branch rules and deploy settings.   |
| `harness check \| sync` | Show local edits to `.claude/`, or update it from this CLI's copy. |

`create-tanstack-cf-saas --help` lists every flag. The wizard, step by step, is in the
[repository's README](https://github.com/SeanningTatum/tanstack-cf-saas-starter#readme).
