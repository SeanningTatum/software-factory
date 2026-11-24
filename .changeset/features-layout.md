---
"create-tanstack-cf-saas": minor
"@tanstack-cf-saas/blocks": minor
"@tanstack-cf-saas/lint": minor
---

Arrange projects by feature: `src/app/` is the kernel and each feature lives in `src/features/<name>/` with a `feature.json` and a `TIMELINE.md`. `d1` is now `db` and `r2` is now `uploads`. The CLI takes `--features` (`--blocks`, `d1` and `r2` still work), and a new project's timelines start with one History line. `cf-saas-lint` adds the `feature-layout` rule and the `timeline` gate.

Add a `core` group. Core holds shared modules of one kind: components only, or services and helpers only. A module with both, or with a page, is a feature. `db`, `kv`, `observability`, `analytics` and `ui` move to `src/features/core/<name>/`; shared pure helpers (`outsideCall`, `binding`) live in `src/features/core/lib/`; `consent`, `home`, `auth`, `billing`, `uploads` and `workflows` stay in `src/features/<name>/`. Names stay flat, so `--features db,kv` and `remove kv` are unchanged.

- Breaking: the manifest flag `"core": true` is now `"required": true`; `cf-saas-blocks` refuses a `feature.json` that still has `core` and says to rename it.
- `@tanstack-cf-saas/blocks`: `loadManifests` reads both levels and returns `Feature` (a manifest plus its `dir`); adds `featureDir`, `isCoreModule`, `CORE_DIR`, `SHARED_LIB_DIR`, `SHARED_LIB`, `RESERVED_NAMES` and the `Features` type. `timelinePath` and `scanFeature` take a folder instead of a name. `FEATURES.md` groups core modules and features. `check` enforces the core import rules: nothing in core imports a feature outside it, `core/lib` imports only `src/app`.
- `@tanstack-cf-saas/lint`: `feature-layout` holds each core module to one kind and `core/lib` to flat `.ts` files; the new `shared-lib` rule keeps services, layers and React out of `core/lib`. `featureLayout.core` configures it. `{feature}` in the test map and the timeline gate use the folder (`core/kv`). Glob braces may hold globs (`{*,core/*}`). Adds `placeOf` and `coreRule`.
- `create-tanstack-cf-saas`: scaffold, prune, `add` and `remove` follow the two levels; the matrix's core-only combination is now called `required`.
