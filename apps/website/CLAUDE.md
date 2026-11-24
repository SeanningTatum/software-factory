# Project rules

Every rule here is checked by `bun run check`. If a check and this file disagree, the check wins.

## Layout

- `src/app/` is the kernel: the runtime, request, env, errors, middleware, run-effect, security
  headers and the page shell. It imports only itself, `src/gen/` and required features and modules.
- Core holds shared modules of one kind: components only, or services and helpers only. A module
  with both, or with a page, is a feature. Your own code goes in a feature, beside `auth` and
  `billing`.
  - `src/features/core/<name>/` is a core module: `db`, `kv`, `observability`, `analytics` (services
    and helpers: `api/`, `lib/`, `machines/`, the top-level files below, and server routes under
    `routes/api/` only) and `ui` (components only: `components/`, `lib/`, `feature.json`,
    `TIMELINE.md`, `constants.ts`; no machines). No core module has `e2e/` or a page.
  - `src/features/core/lib/` holds pure helpers that two or more features use: flat `.ts` files,
    each with a sibling test, no `feature.json`. Plain functions and Effect functions only: no
    services, layers or React (rule `shared-lib`). It imports only `src/app`.
  - `src/features/<name>/` is a feature: `consent`, `home`, `auth`, `billing`, `uploads`,
    `workflows`.
- Names are unique across both levels, and `core` and `lib` are reserved. Tools find a feature's
  folder from its name, so `--features db,auth` and `cf-saas-blocks remove kv` work wherever it
  lives.
- A feature or module owns its folder and the paths its `feature.json` lists in `files`, and
  nothing else. `cf-saas-lint` (rule `feature-layout`) allows only this vocabulary inside a
  feature; make only the folders it needs:
  - folders: `api/` (server functions and services), `routes/` (file routes, served from the URL
    root), `components/` (React, with UI machines beside them), `machines/` (lifecycle machines),
    `lib/` (pure helpers), `e2e/` (Playwright specs);
  - top-level files: `feature.json`, `TIMELINE.md`, `constants.ts`, `schema.ts`, `events.ts`,
    `errors.ts`, `layer.ts`, `nav.ts`, `viewer.ts`, `auth-plugins.ts`, `workflows.ts`, each with an
    optional sibling `*.test.ts`;
  - `*.machine.ts` only in `components/` or `machines/`, `*.spec.ts` only in `e2e/`;
  - every feature has `feature.json` and `TIMELINE.md`. To change the list, set `featureLayout` in
    `cf-saas-lint.json`.
- Required features and modules have `"required": true` and can't be removed: `observability`,
  `analytics`, `ui`, `consent`, `home`. The rest are optional, in core or not.
- Imports (`cf-saas-blocks check`): a core module imports the kernel, `src/gen/`, `core/lib` and
  other core modules (an optional one only if its `requires` lists it); nothing in core imports a
  feature outside core. A feature imports the kernel, `src/gen/`, `core/lib`, required features and
  modules, and what its `requires` lists, transitively.
- `src/routes/` holds only `__root.tsx`. `src/gen/routes.ts` mounts each feature's `routes/`.
- `src/gen/` is made by `bun run blocks:sync`. Never edit it; change a `feature.json` or a
  feature's `layer.ts`, `errors.ts`, `events.ts`, `nav.ts`, `viewer.ts`, `auth-plugins.ts`,
  `workflows.ts` or `routes/`.
- `FEATURES.md` (made by `bun run blocks:sync`) lists every core module and feature in one line.
- `cf-saas-blocks check` fails on a file outside `src/app/`, `src/features/`, `src/gen/`,
  `src/routes/__root.tsx` and `src/{start.ts,router.tsx,server.ts,styles.css}`.

## Before and after you change a feature

- Read `FEATURES.md`, then the feature's `TIMELINE.md`, before you change it.
- `TIMELINE.md` has three parts. Between `<!-- generated:start -->` and `<!-- generated:end -->`,
  `bun run blocks:sync` writes what the feature is and what it is wired to; `cf-saas-blocks check`
  fails when that is stale. Between `<!-- machines:start -->` and `<!-- machines:end -->`,
  `bun run machines:print` writes each machine's diagram; `bun run test` fails when one is stale.
  Never edit either block by hand.
- Below them, people write `## Decisions` and `## History`, newest first, one line each:
  `- YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>)` and
  `- YYYY-MM-DD — <what changed>. (<commit sha or PR URL>)`.
- Add a Decisions or History line with every change to a feature. On pull requests CI runs
  `bunx cf-saas-lint timeline --base origin/<base>`, which fails when a feature changed with no new
  line. The `no-timeline` label (or `TIMELINE_SKIP=1`) skips it for a trivial change.

```bash
bun run blocks:sync      # src/gen, wrangler.jsonc, .dev.vars.example, FEATURES.md, TIMELINE blocks
bun run machines:print   # machine diagrams into each TIMELINE.md
bunx cf-saas-lint timeline --base origin/main   # the CI timeline gate, run locally
```

## Code

- Effect for everything on the server. Services are `Context.Service` classes with a static `layer`.
  Errors are `Schema.TaggedError` classes in the error channel, each listed in its feature's
  `errors.ts` with a status and a safe message. Validation is Effect Schema; zod is banned.
- No `throw`, `try/catch`, `process.env` or `Effect.run*` outside the edges listed in
  `cf-saas-lint.json`. Server functions and server routes run effects through `runEffect` /
  `runResponse` from `src/app/run-effect.ts`.
- Every outside call is an `Effect.tryPromise` inside `Effect.fn("Name.method")` or piped through
  `Effect.withSpan`; `outsideCall` in `core/lib/call.ts` does both.
- Log with `Effect.log*`, never `console`. Every line already carries the request id and user.
- Every flow a user can see, and every lifecycle, is an XState machine in a `*.machine.ts` file with a
  unit test. Machines that drive UI sit in a feature's `components/` and also need
  `e2e/<name>.paths.spec.ts` in that feature.
- New user-visible outcomes get an analytics event in the feature's `events.ts`. No personal data in
  event properties.
- Every source file under `src/app` and `src/features` has a sibling `*.test.ts` unless
  `cf-saas-lint.json` exempts it.
