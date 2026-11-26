# @tanstack-cf-saas/lint

## 0.1.0

### Minor Changes

- 33d05bf: `cf-saas-lint` adds the `rules-file` rule: it fails when `CLAUDE.md` runs past `maxRulesLines` (80 by default) or names something that is not there: a backticked path whose top folder exists but which does not, a `bun run` script missing from `package.json`, or a "rule `x`" that is not a rule.
  
  The template it ships now writes an `audit_log` row for every sign-up, sign-in (failed ones too), sign-out and plan change; posts the first error of a burst to an optional `ALERT_WEBHOOK_URL`; ships `docs/runbook.md`; ties a consented anonymous id to the user at sign-up and sign-in, and resets it at sign-out; and has each feature's `events.ts` export a `metric` that a test checks against the event catalog.
- 769aaff: Arrange projects by feature: `src/app/` is the kernel and each feature lives in `src/features/<name>/` with a `feature.json` and a `TIMELINE.md`. `d1` is now `db` and `r2` is now `uploads`. The CLI takes `--features` (`--blocks`, `d1` and `r2` still work), and a new project's timelines start with one History line. `cf-saas-lint` adds the `feature-layout` rule and the `timeline` gate.
  
  Add a `core` group. Core holds shared modules of one kind: components only, or services and helpers only. A module with both, or with a page, is a feature. `db`, `kv`, `observability`, `analytics` and `ui` move to `src/features/core/<name>/`; shared pure helpers (`outsideCall`, `binding`) live in `src/features/core/lib/`; `consent`, `home`, `auth`, `billing`, `uploads` and `workflows` stay in `src/features/<name>/`. Names stay flat, so `--features db,kv` and `remove kv` are unchanged.
  
  - Breaking: the manifest flag `"core": true` is now `"required": true`; `cf-saas-blocks` refuses a `feature.json` that still has `core` and says to rename it.
  - `@tanstack-cf-saas/blocks`: `loadManifests` reads both levels and returns `Feature` (a manifest plus its `dir`); adds `featureDir`, `isCoreModule`, `CORE_DIR`, `SHARED_LIB_DIR`, `SHARED_LIB`, `RESERVED_NAMES` and the `Features` type. `timelinePath` and `scanFeature` take a folder instead of a name. `FEATURES.md` groups core modules and features. `check` enforces the core import rules: nothing in core imports a feature outside it, `core/lib` imports only `src/app`.
  - `@tanstack-cf-saas/lint`: `feature-layout` holds each core module to one kind and `core/lib` to flat `.ts` files; the new `shared-lib` rule keeps services, layers and React out of `core/lib`. `featureLayout.core` configures it. `{feature}` in the test map and the timeline gate use the folder (`core/kv`). Glob braces may hold globs (`{*,core/*}`). Adds `placeOf` and `coreRule`.
  - `create-tanstack-cf-saas`: scaffold, prune, `add` and `remove` follow the two levels; the matrix's core-only combination is now called `required`.
- 0408a75: The test map now needs a browser spec for every route file: `e2e/<route>.route.spec.ts`, where `{route}` is the path under `routes/` with `/` as `.` and `$` dropped. A core module's routes take theirs in `home`. A map entry with `always: true` also applies to files in `testExempt`.
  
  The template it ships has a working and a failing browser spec for each page and API route, an axe scan in every page spec, coverage floors in `bun run test`, and a size budget for every page: `bun run size` now fails on a page with no budget.

### Patch Changes

- 9495429: `add` no longer overwrites a file the project already has (such as its own `drizzle.config.ts`): it stops and names the paths. It also checks for name clashes before it copies anything, so a clash leaves no stray folder behind. A feature manifest may not list `.git` or `node_modules` in `files`.
  
  `sync` and `check` treat CRLF and LF text as equal, so a Windows checkout is not reported stale. Each project made by `create` now gets its own rate-limit `namespace_id`s (they are account-wide on Cloudflare), and `sync` keeps the ones in `wrangler.jsonc`.
  
  `harness check` exits 1 when files changed or are missing, and writes lock keys with `/` on Windows. `setup --var FOO` without `=` is an error. `setup` keeps the indent of `wrangler.jsonc`, and a space in the project path no longer breaks wrangler on Windows. The feature matrix fails on an unknown `--only`, and also removes and re-adds each feature and runs `cf-saas-blocks check` after each step.
- 5c091fd: `cf-saas-lint` now reads source through `@typescript/typescript6` instead of `typescript`. TypeScript 7 no longer ships the JavaScript API the linter parses with, so a project on TypeScript 7 crashed on lint. The linter brings its own copy now, and works whichever TypeScript the project compiles with.
- 60d28cb: New lint rule `no-nested-yield`: a `yield*` may not sit inside another `yield*` in the same generator, in source or tests. Write `const uploads = yield* Uploads;` and then `yield* uploads.list(...)`, not `yield* (yield* Uploads).list(...)`. The template's routes, onboarding steps and tests are rewritten to match.
- 7fe29b2: `cf-saas-lint timeline` with no `--base` now compares with `origin/staging` first, then `origin/main`, then the last commit. Projects made by the CLI have `staging` as their default branch, so the old default fell through to the last commit and missed earlier ones.
