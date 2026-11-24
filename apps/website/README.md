# Website

TanStack Start on Cloudflare Workers, written in Effect, with every flow drawn as a state machine.
Made with `create-tanstack-cf-saas`.

## Run it

```bash
bun install
bun run db:migrate:local   # when the d1 block is on
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

## Blocks

Each block lives in three places and nothing else: `src/blocks/<name>/`, `src/routes/(<name>)/` and
`e2e/<name>/`. Everything they share (the runtime's layers, the error map, the event catalog, the
nav, wrangler bindings, `.dev.vars.example`) is generated from their `block.json` by
`bun run blocks:sync`.

```bash
bunx create-tanstack-cf-saas add kv
bunx create-tanstack-cf-saas remove kv
```

## Checks

`bun run check` runs Biome, the house rules (`cf-saas-lint`), the block boundary check, the type
checker, the unit tests (including the state machine gate) and knip. `bun run machines:print`
writes each machine as a Mermaid diagram into `docs/machines/`.
