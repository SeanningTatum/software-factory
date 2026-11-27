# SaaS Starter

TanStack Start on Cloudflare Workers, written in Effect, with every flow drawn as a state machine.
Made with `create-tanstack-cf-saas`.

## Run it

```bash
bun install
bun run db:migrate:local   # when the db feature is on
bun run dev
```

After you change a `schema.ts`, name the migration for what it changes; the script fails without a
name:

```bash
bun run db:generate add_invoices   # writes drizzle/0001_add_invoices.sql
```

`.dev.vars` holds local settings and secrets; `.dev.vars.example` lists every one with what it is for.

## Ship it

The `create` wizard offers these steps when it makes the project. Run them again here after you
add a feature, or if you skipped one. The project holds the CLI that made it as a dev dependency,
so after `bun install` these run that copy and fetch nothing:

```bash
bun run setup                        # D1, KV and R2, migrations, secrets and a first deploy, for production and staging
bun run setup --check                # what is still missing, and the command that fixes each
bunx create-tanstack-cf-saas github  # the GitHub repository, its branches and rules, what CI deploys with, and an issue per manual setup step
bun run deploy:staging               # by hand
bun run deploy
```

<!-- github:start -->

Two branches deploy. `staging` is the default branch, and a push to it deploys staging.
`production` deploys production. It takes no pull requests: a release tags `staging`'s tip and
moves `production` to that same commit in one push, so both branches share one head:

```bash
git fetch origin
git push --atomic origin origin/staging:refs/tags/v1.2.0 origin/staging:refs/heads/production
```

The same release is a button on GitHub: Actions → promote → Run workflow, with the tag. The
button can also give the release to a share of visitors first (`gradual`); Actions → rollout then
raises the share, finishes it, or backs out.

Work in small pull requests stacked on each other. One whose base is another branch gets the short
checks in `pr.yml` (lint, types, unit tests, a scan for keys). The pull request that rolls the
stack up into `staging` gets all of `ci.yml`, the same checks production requires. The rules live
in `.github/rulesets/`; change a file and run `github` again to apply it. Add your own workflows
beside the six in `.github/workflows/`. `docs/branches.md` draws the whole flow and says why each
rule is there.

<!-- github:end -->

## Layout

```
src/
  app/                   the kernel: runtime, request, env, errors, middleware
  features/
    core/<name>/         a core module: db, kv, email, email-templates, observability, analytics, ui
    core/lib/            shared pure helpers, such as outsideCall and binding
    <name>/              a feature: consent, home, auth, auth-email, billing, uploads, workflows, and yours
  gen/                   made by `bun run blocks:sync`; never edit
  routes/__root.tsx      the only route outside a feature
```

Core holds shared modules of one kind: components only (`ui`, `email-templates`), or services and helpers only (`db`,
`kv`, `email`, `observability`, `analytics`). A module with both, or with a page, is a feature and lives
beside `auth` and `billing`; put your own product features there too. `core/lib/` holds pure
helpers that two or more features use.

Each feature or module lives in its own folder and nothing else. `observability`, `analytics`,
`ui`, `consent` and `home` are required and always on. `db`, `kv`, `email`, `auth`, `billing`,
`uploads` and `workflows` are optional and come and go, wherever they live; `auth-email` is on
whenever `auth` and `email` both are, and `email-templates` whenever `email` is. A feature's `routes/` folder is
served from the URL root, so
`src/features/auth/routes/login.tsx` is `/login`. What features share (the runtime's layers, the
error map, the event catalog, the nav, the route tree, wrangler bindings, `.dev.vars.example`) is
built from their `feature.json` by `bun run blocks:sync`.

```bash
bunx create-tanstack-cf-saas add kv
bunx create-tanstack-cf-saas remove kv
```

`FEATURES.md` lists every core module and feature in one line each. Each one's `TIMELINE.md` says
what it is, what it is wired to and why it is built the way it is: a block that `blocks:sync`
writes, the diagrams of its machines, and Decisions and History lines people write. Read both
before changing a feature, and add a line to its timeline with the change.

## Sending mail (`email`)

Every mail is a React Email component wrapped in `MailLayout`, so they all look like one product.
Never hand-write mail HTML. To add one:

1. Write the mail in your feature's `components/`, from the parts in
   `src/features/core/email-templates/components/mail.tsx`: `MailLayout`, `MailText`, `MailButton`
   and `MailCode`. `src/features/auth-email/components/code-mail.tsx` is one to copy.
2. Render it with `renderMail`, which returns the HTML and a plain-text part made from it, and hand
   both to `Email.send` with a subject and a recipient.
3. Keep codes and secrets out of the `preview`: inboxes and lock screens show it.

Change the look in `mail.tsx`; every mail follows. Styles are inline because mail clients ignore
stylesheets. Cloudflare Email Service is for transactional mail: receipts, codes, notices. A
newsletter can reuse these components, but send it through a provider built for marketing, which
handles unsubscribes and consent.

## Checks

`bun run check` runs Biome, the house rules (`cf-saas-lint`), the feature boundary check, the type
checker, the unit tests (including the state machine gate) and knip. `bun run machines:print`
writes each machine's Mermaid diagram into its feature's `TIMELINE.md`; the tests fail when one is
out of date. With the GitHub workflows, CI also runs `cf-saas-lint timeline` on pull requests,
which fails when a feature changed without a new line in its `TIMELINE.md`; the `no-timeline`
label skips it.
