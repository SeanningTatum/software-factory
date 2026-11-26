# @tanstack-cf-saas/blocks

## 0.2.0

### Minor Changes

- 769aaff: Arrange projects by feature: `src/app/` is the kernel and each feature lives in `src/features/<name>/` with a `feature.json` and a `TIMELINE.md`. `d1` is now `db` and `r2` is now `uploads`. The CLI takes `--features` (`--blocks`, `d1` and `r2` still work), and a new project's timelines start with one History line. `cf-saas-lint` adds the `feature-layout` rule and the `timeline` gate.
  
  Add a `core` group. Core holds shared modules of one kind: components only, or services and helpers only. A module with both, or with a page, is a feature. `db`, `kv`, `observability`, `analytics` and `ui` move to `src/features/core/<name>/`; shared pure helpers (`outsideCall`, `binding`) live in `src/features/core/lib/`; `consent`, `home`, `auth`, `billing`, `uploads` and `workflows` stay in `src/features/<name>/`. Names stay flat, so `--features db,kv` and `remove kv` are unchanged.
  
  - Breaking: the manifest flag `"core": true` is now `"required": true`; `cf-saas-blocks` refuses a `feature.json` that still has `core` and says to rename it.
  - `@tanstack-cf-saas/blocks`: `loadManifests` reads both levels and returns `Feature` (a manifest plus its `dir`); adds `featureDir`, `isCoreModule`, `CORE_DIR`, `SHARED_LIB_DIR`, `SHARED_LIB`, `RESERVED_NAMES` and the `Features` type. `timelinePath` and `scanFeature` take a folder instead of a name. `FEATURES.md` groups core modules and features. `check` enforces the core import rules: nothing in core imports a feature outside it, `core/lib` imports only `src/app`.
  - `@tanstack-cf-saas/lint`: `feature-layout` holds each core module to one kind and `core/lib` to flat `.ts` files; the new `shared-lib` rule keeps services, layers and React out of `core/lib`. `featureLayout.core` configures it. `{feature}` in the test map and the timeline gate use the folder (`core/kv`). Glob braces may hold globs (`{*,core/*}`). Adds `placeOf` and `coreRule`.
  - `create-tanstack-cf-saas`: scaffold, prune, `add` and `remove` follow the two levels; the matrix's core-only combination is now called `required`.
- 638d478: With `auth`, sign-up can need a Cloudflare Turnstile token. Set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` and `/signup` shows the widget and Better Auth refuses a sign-up without a valid token (400 with none, 403 when Cloudflare rejects it); leave them empty and sign-up works as before. `.dev.vars.example` carries Cloudflare's always-pass test keys, so dev and the browser specs run guarded; put real keys in at deploy. The production CSP gains `frame-src https://challenges.cloudflare.com`. `cf-saas-blocks` supports an `example` on a var or secret in `feature.json`, shown in `.dev.vars.example` in place of its deployed default.

### Patch Changes

- 9495429: `add` no longer overwrites a file the project already has (such as its own `drizzle.config.ts`): it stops and names the paths. It also checks for name clashes before it copies anything, so a clash leaves no stray folder behind. A feature manifest may not list `.git` or `node_modules` in `files`.
  
  `sync` and `check` treat CRLF and LF text as equal, so a Windows checkout is not reported stale. Each project made by `create` now gets its own rate-limit `namespace_id`s (they are account-wide on Cloudflare), and `sync` keeps the ones in `wrangler.jsonc`.
  
  `harness check` exits 1 when files changed or are missing, and writes lock keys with `/` on Windows. `setup --var FOO` without `=` is an error. `setup` keeps the indent of `wrangler.jsonc`, and a space in the project path no longer breaks wrangler on Windows. The feature matrix fails on an unknown `--only`, and also removes and re-adds each feature and runs `cf-saas-blocks check` after each step.
- 675e4b9: `cf-saas-blocks` no longer loses work or half-applies a change:
  
  - `removeBlock` refuses a feature with uncommitted changes, or one outside a git repository, unless passed `{ force: true }`. `cf-saas-blocks remove <feature>` takes `--force`; the CLI's `remove --force` now passes it through instead of checking on its own.
  - `addBlock` checks the project can sync before it copies anything, so a broken `wrangler.jsonc` no longer leaves a half-added feature behind.
  - `loadManifests` throws `"X" is declared by both a and b` when two features declare the same var, secret, binding or workflow class, instead of generating code that doesn't compile.
  - A rate-limit binding's `namespace_id` must be digits; it used to become `"NaN"` in `wrangler.jsonc`.
- cb0ef31: Features load in name order on every file system, so generated files no longer differ between macOS and Linux.
- Updated dependencies [33d05bf]
- Updated dependencies [9495429]
- Updated dependencies [769aaff]
- Updated dependencies [5c091fd]
- Updated dependencies [60d28cb]
- Updated dependencies [0408a75]
- Updated dependencies [7fe29b2]
  - @tanstack-cf-saas/lint@0.2.0
