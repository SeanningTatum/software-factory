# Docs Website

TanStack Start on Cloudflare Workers, written in Effect, with every flow drawn as a state machine.
Made with `create-software-factory`.

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
bun run deploy:staging               # by hand
bun run deploy
```

## Layout

```
src/
  app/                   the kernel: runtime, request, env, errors, middleware
  features/
    core/<name>/         a core module: db, kv, observability, analytics, ui
    core/lib/            shared pure helpers, such as outsideCall and binding
    <name>/              a feature: consent, home, auth, billing, uploads, workflows, and yours
  gen/                   made by `bun run blocks:sync`; never edit
  routes/__root.tsx      the only route outside a feature
```

Core holds shared modules of one kind: components only (`ui`), or services and helpers only (`db`,
`kv`, `observability`, `analytics`). A module with both, or with a page, is a feature and lives
beside `auth` and `billing`; put your own product features there too. `core/lib/` holds pure
helpers that two or more features use.

Each feature or module lives in its own folder and nothing else. `observability`, `analytics`,
`ui`, `consent` and `home` are required and always on. `db`, `kv`, `auth`, `billing`, `uploads`
and `workflows` are optional and come and go, wherever they live. A feature's `routes/` folder is
served from the URL root, so
`src/features/auth/routes/login.tsx` is `/login`. What features share (the runtime's layers, the
error map, the event catalog, the nav, the route tree, wrangler bindings, `.dev.vars.example`) is
built from their `feature.json` by `bun run blocks:sync`.

```bash
bunx create-software-factory add kv
bunx create-software-factory remove kv
```

`FEATURES.md` lists every core module and feature in one line each. Each one's `TIMELINE.md` says
what it is, what it is wired to and why it is built the way it is: a block that `blocks:sync`
writes, the diagrams of its machines, and Decisions and History lines people write. Read both
before changing a feature, and add a line to its timeline with the change.

## Checks

`bun run check` runs Biome, the house rules (`software-factory-lint`), the feature boundary check, the type
checker, the unit tests (including the state machine gate) and knip. `bun run machines:print`
writes each machine's Mermaid diagram into its feature's `TIMELINE.md`; the tests fail when one is
out of date. With the GitHub workflows, CI also runs `software-factory-lint timeline` on pull requests,
which fails when a feature changed without a new line in its `TIMELINE.md`; the `no-timeline`
label skips it.
