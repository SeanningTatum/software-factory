# tanstack-cf-saas-starter

A monorepo for a SaaS template (TanStack Start on Cloudflare Workers, written in Effect), the CLI
that builds projects from it, and the website that sells it.

## Layout

| Path                      | What it is                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `templates/saas-starter/` | The template, with every feature on. Its own `CLAUDE.md` holds the code rules.                                                |
| `apps/cli/`               | `create-tanstack-cf-saas`: `create`, `add`, `remove`, `setup`, `harness`. Ships the template and `claude/`.                   |
| `apps/website/`           | The marketing and docs site: the CLI's output with every feature, plus its own required feature `site`.                       |
| `packages/biome-config/`  | Shared Biome rules (published).                                                                                               |
| `packages/tsconfig/`      | Shared TypeScript presets (published).                                                                                        |
| `packages/lint/`          | `cf-saas-lint`: house rules, test map, feature layout, timeline gate, machine checker (published).                            |
| `packages/blocks/`        | `cf-saas-blocks`: feature manifests, the generators for `src/gen`, `FEATURES.md` and timelines, add/remove/prune (published). |
| `claude/`                 | The shared Claude workflows. A placeholder until the real repo is added as a git submodule.                                   |

## Rules

- **Core holds shared modules of one kind: components only, or services and helpers only. A module
  with both, or with a page, is a feature.** Core modules live in `src/features/core/<name>/` (`db`,
  `kv`, `observability`, `analytics`, `ui`), shared pure helpers in `src/features/core/lib/`, and
  features in `src/features/<name>/` (`consent`, `home`, `auth`, `billing`, `uploads`,
  `workflows`, and the user's own).
- **A feature or module owns one folder and nothing else**, plus the paths its `feature.json` lists
  in `files`. Names are unique across both levels; tools find the folder from the name. The kernel
  is `src/app/`. Shared wiring is generated into `src/gen/` by `cf-saas-blocks sync`; never
  hand-edit it. Required ones (`"required": true`: `observability`, `analytics`, `ui`, `consent`,
  `home`) can't be removed; `db`, `kv`, `auth`, `billing`, `workflows` and `uploads` can.
- **Read `FEATURES.md` and the feature's `TIMELINE.md` first**, and add a Decisions or History line
  to it with every change to the feature or module.
- **The template never depends on this repo's layout.** It imports `@tanstack-cf-saas/*` packages by
  name; the CLI's bundle step swaps `workspace:*` for published versions.
- **A change to the template is proven by the feature matrix**, not only by the template's own
  tests: `bun run --filter create-tanstack-cf-saas test:matrix`. It scaffolds the required features
  alone, each optional one with what it requires, and everything together, then runs every gate on
  each.
- Server code in the template is Effect; every flow and lifecycle is an XState machine. The rules and
  the gates that enforce them are in `templates/saas-starter/CLAUDE.md`.

## Commands

```bash
bun install
bun run check                                              # lint, typecheck, test, build everywhere
bun run --cwd templates/saas-starter dev                   # work on the template
bun run --filter create-tanstack-cf-saas test:matrix       # prove every feature combination
node apps/cli/dist/index.js my-app --features db,auth      # try the CLI (after bun run build)
```

## Claude workflows submodule

`claude/` is a placeholder. When the shared repo exists:

```bash
git rm -r claude && git submodule add <git-url> claude
git submodule update --remote claude   # later, to take the latest
```

The CLI copies it into each new project's `.claude/` and records a hash per file in
`harness.lock.json`; `create-tanstack-cf-saas harness check|sync` compares and refreshes it.

## Releasing

`bun run changeset` to describe a change, then merge; `release.yml` publishes `packages/*` and the CLI
under the `@tanstack-cf-saas` npm scope (claim it before the first publish).
