# tanstack-cf-saas-starter

A SaaS template on TanStack Start and Cloudflare Workers, the CLI that builds projects from it, and
the website that documents it.

## Run it locally

You need [Bun](https://bun.sh) 1.4 or newer. Nothing else: the database, KV and R2 run on your
machine through wrangler, with no Cloudflare account.

```bash
bun install
```

### The template app

```bash
cd templates/saas-starter
cp .dev.vars.example .dev.vars
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .dev.vars
bun run db:migrate:local
bun run dev
```

Open http://localhost:3000. Sign up with any email and password; it all stays in a local database
under `.wrangler/`.

What you can try without any keys: sign-up and sign-in, the dashboard, file uploads, and the
consent banner. Billing shows a setup hint until you add Stripe test keys to `.dev.vars`.

### The website

```bash
cd apps/website
cp .dev.vars.example .dev.vars
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .dev.vars
bun run db:migrate:local
bun run dev --port 3001
```

Open http://localhost:3001.

## Check your changes

From the repo root:

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
bun run --filter create-tanstack-cf-saas test:matrix
```

## Try the CLI

```bash
bun run try
```

This builds the CLI, then runs the real wizard and creates a project in `../cf-saas-try`, beside
this repo. Run it again and it replaces that folder. Then follow the steps the wizard prints:

```bash
cd ../cf-saas-try
bun run db:migrate:local
bun run dev
```

To skip the questions, or pick the folder:

```bash
bun run try --features db,auth,uploads --yes
bun run try ../my-app --features db,auth
```

Features to choose from: `db`, `auth`, `billing`, `kv`, `workflows`, `uploads`.

Why a script: a new project depends on the `@tanstack-cf-saas/*` packages, and they are not on npm
yet. `bun run try` packs them from this repo and points the new project at those files, so a
project made this way is for trying things, not for shipping.

## Where things are

| Path                      | What it is                                                                       |
| ------------------------- | -------------------------------------------------------------------------------- |
| `templates/saas-starter/` | The template, with every feature on. Start with its `FEATURES.md`.               |
| `apps/cli/`               | `create-tanstack-cf-saas`                                                        |
| `apps/website/`           | The landing page and docs, built from the template                               |
| `packages/`               | Shared lint rules, TypeScript presets, and the tool that wires features together |

The code rules are in `CLAUDE.md` here and in `templates/saas-starter/CLAUDE.md`.
