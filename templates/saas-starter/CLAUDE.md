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
  - `src/features/<name>/` is a feature: `consent`, `home`, `auth`, `billing`, `uploads`, `workflows`.
- Names are unique across both levels; `core` and `lib` are reserved. Tools find a folder by name.
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
- `"required": true` ones can't be removed: `observability`, `analytics`, `ui`, `consent`, `home`.
- Imports (`cf-saas-blocks check`): a core module imports the kernel, `src/gen/`, `core/lib` and
  other core modules (an optional one only if its `requires` lists it); nothing in core imports a
  feature outside core. A feature imports the kernel, `src/gen/`, `core/lib`, required features and
  modules, and what its `requires` lists, transitively.
- `src/routes/` holds only `__root.tsx`. `src/gen/routes.ts` mounts each feature's `routes/`.
- `bun run blocks:sync` writes `src/gen/`, `FEATURES.md`, `.dev.vars.example` and the bindings in
  `wrangler.jsonc`. Never edit those by hand; change a `feature.json` or the feature's own files.
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

## Code

- Effect for everything on the server. Services are `Context.Service` classes with a static `layer`.
  Errors are `Schema.TaggedError` classes in the error channel, each listed in its feature's
  `errors.ts` with a status and a safe message. Validation is Effect Schema; zod is banned.
- No `throw`, `try/catch`, `process.env` or `Effect.run*` outside the edges listed in
  `cf-saas-lint.json`. Server functions and server routes run effects through `runEffect` /
  `runResponse` from `src/app/run-effect.ts`.
- Every outside call is an `Effect.tryPromise` inside `Effect.fn("Name.method")` or piped through
  `Effect.withSpan`; `outsideCall` in `src/features/core/lib/call.ts` does both.
- Log with `Effect.log*`, never `console`. Every line already carries the request id and user.
- With `auth`, sign-ins, sign-outs and plan changes pass through `Auth.handle` into analytics and
  `audit_log`. What on-call does is in `docs/runbook.md`; keep it true when you change a flow.
- Every flow a user can see, and every lifecycle, is an XState machine in a `*.machine.ts` file with a
  unit test. Machines that drive UI sit in a feature's `components/` and also need
  `e2e/<name>.paths.spec.ts` in that feature.
- New user-visible outcomes get an analytics event in the feature's `events.ts`, which also exports
  `metric`: the feature's success measure and the catalog events behind it (a test checks both). No
  personal data in event properties.
- Every source file under `src/app` and `src/features` has a sibling `*.test.ts` unless
  `cf-saas-lint.json` exempts it.
