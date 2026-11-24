# Website

TanStack Start on Cloudflare Workers, written in Effect, with every flow drawn as a state machine.
Made with `create-tanstack-cf-saas`.

## Run it

```bash
bun install
bun run db:migrate:local   # when the db feature is on
bun run dev
```

`.dev.vars` holds local settings and secrets; `.dev.vars.example` lists every one with what it is for.

## Ship it

```bash
bunx create-tanstack-cf-saas setup          # create D1, KV and R2, set secrets, for production and staging
bunx create-tanstack-cf-saas setup --check  # what is still missing, and the command that fixes each
bun run deploy:staging
bun run deploy
```

## Layout

```
src/
  app/              the kernel: runtime, request, env, errors, middleware
  features/<name>/  one feature: api/, routes/, components/, machines/, lib/, e2e/, feature.json,
                    TIMELINE.md
  gen/              made by `bun run blocks:sync`; never edit
  routes/__root.tsx the only route outside a feature
```

Each feature lives in its own folder and nothing else. `observability`, `analytics`, `consent`,
`ui` and `home` are core and always on. `db`, `auth`, `billing`, `kv`, `uploads` and `workflows`
come and go. A feature's `routes/` folder is served from the URL root, so
`src/features/auth/routes/login.tsx` is `/login`. What features share (the runtime's layers, the
error map, the event catalog, the nav, the route tree, wrangler bindings, `.dev.vars.example`) is
built from their `feature.json` by `bun run blocks:sync`.

```bash
bunx create-tanstack-cf-saas add kv
bunx create-tanstack-cf-saas remove kv
```

`FEATURES.md` lists every feature in one line each. Each feature's `TIMELINE.md` says what it is,
what it is wired to and why it is built the way it is: a block that `blocks:sync` writes, the
diagrams of its machines, and Decisions and History lines people write. Read both before changing
a feature, and add a line to its timeline with the change.

## Checks

`bun run check` runs Biome, the house rules (`cf-saas-lint`), the feature boundary check, the type
checker, the unit tests (including the state machine gate) and knip. `bun run machines:print`
writes each machine's Mermaid diagram into its feature's `TIMELINE.md`; the tests fail when one is
out of date. On pull requests CI also runs `cf-saas-lint timeline`, which fails when a feature
changed without a new line in its `TIMELINE.md`; the `no-timeline` label skips it.
