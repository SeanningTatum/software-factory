# Project rules

Every rule here is checked by `bun run check`. If a check and this file disagree, the check wins.

## Layout

- `src/app/` is the kernel: the runtime, request, env, errors, middleware, run-effect, security
  headers and the page shell. It imports only itself, `src/gen/` and core features.
- `src/features/<name>/` is one feature. It owns that folder and the paths its `feature.json` lists
  in `files`, and nothing else. `cf-saas-lint` (rule `feature-layout`) allows only this vocabulary
  inside it; make only the folders a feature needs:
  - folders: `api/` (server functions and services), `routes/` (file routes, served from the URL
    root), `components/` (React, with UI machines beside them), `machines/` (lifecycle machines),
    `lib/` (pure helpers), `e2e/` (Playwright specs);
  - top-level files: `feature.json`, `TIMELINE.md`, `constants.ts`, `schema.ts`, `events.ts`,
    `errors.ts`, `layer.ts`, `nav.ts`, `viewer.ts`, `auth-plugins.ts`, `workflows.ts`, each with an
    optional sibling `*.test.ts`;
  - `*.machine.ts` only in `components/` or `machines/`, `*.spec.ts` only in `e2e/`;
  - every feature has `feature.json` and `TIMELINE.md`. To change the list, set `featureLayout` in
    `cf-saas-lint.json`.
- Core features have `"core": true` and can't be removed: `observability`, `analytics`, `consent`,
  `ui`, `home`. They import the kernel, `src/gen/` and each other.
- Other features import the kernel, `src/gen/`, core features and what their `requires` lists.
- `src/routes/` holds only `__root.tsx`. `src/gen/routes.ts` mounts each feature's `routes/`.
- `src/gen/` is made by `bun run blocks:sync`. Never edit it; change a `feature.json` or a
  feature's `layer.ts`, `errors.ts`, `events.ts`, `nav.ts`, `viewer.ts`, `auth-plugins.ts`,
  `workflows.ts` or `routes/`.
- `FEATURES.md` (made by `bun run blocks:sync`) lists every feature in one line.
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
  `Effect.withSpan`.
- Log with `Effect.log*`, never `console`. Every line already carries the request id and user.
- Every flow a user can see, and every lifecycle, is an XState machine in a `*.machine.ts` file with a
  unit test. Machines that drive UI sit in a feature's `components/` and also need
  `e2e/<name>.paths.spec.ts` in that feature.
- New user-visible outcomes get an analytics event in the feature's `events.ts`. No personal data in
  event properties.
- Every source file under `src/app` and `src/features` has a sibling `*.test.ts` unless
  `cf-saas-lint.json` exempts it.
