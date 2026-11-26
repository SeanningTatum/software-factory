# tanstack-cf-saas-starter

A monorepo for a SaaS template (TanStack Start on Cloudflare Workers, written in Effect) and the CLI
that builds projects from it.

## Layout

| Path                      | What it is                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `templates/saas-starter/` | The template, with every feature on. Its own `CLAUDE.md` holds the code rules.                                                |
| `apps/cli/`               | `create-tanstack-cf-saas`: `create`, `add`, `remove`, `setup`, `github`, `harness`. Ships the template and `claude/`.         |
| `packages/biome-config/`  | Shared Biome rules (published).                                                                                               |
| `packages/tsconfig/`      | Shared TypeScript presets (published).                                                                                        |
| `packages/lint/`          | `cf-saas-lint`: house rules, test map, feature layout, timeline gate, machine checker (published).                            |
| `packages/blocks/`        | `cf-saas-blocks`: feature manifests, the generators for `src/gen`, `FEATURES.md` and timelines, add/remove/prune (published). |
| `claude/`                 | The Claude harness the CLI ships to new projects, as plain files. A stand-in until B-08.                                      |

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
- **Read `FEATURES.md` and the feature's `TIMELINE.md` first, and add no lines to it.** The template
  is boilerplate: only a project made from it keeps a timeline, and the CLI starts each one's
  History afresh. Here History stays empty, and a Decisions line that a change makes untrue is
  fixed or deleted. This overrides the template's own `CLAUDE.md` and `FEATURES.md`, which tell the
  projects made from it to add a line with every change.
- **The template never depends on this repo's layout.** It imports `@tanstack-cf-saas/*` packages by
  name; the CLI's bundle step swaps `workspace:*` for published versions.
- **A change to the template is proven by the feature matrix**, not only by the template's own
  tests: `bun run --filter create-tanstack-cf-saas test:matrix`. It scaffolds the required features
  alone, each optional one with what it requires, and everything together, then runs every gate on
  each.
- **The template keeps one migration, `drizzle/0000_init.sql`.** After a schema change, delete
  `drizzle/*.sql` and `drizzle/meta/`, and run `bun run db:generate init`. New projects never see
  it: the CLI's bundle leaves `drizzle/` out and `create` generates their own `0000_init.sql`.
- Server code in the template is Effect; every flow and lifecycle is an XState machine. The rules and
  the gates that enforce them are in `templates/saas-starter/CLAUDE.md`.

## Open work

`BACKLOG.md` lists it in order, one item per change, in a fixed format. Add new work there in that
format; when an item is done, delete it and update its row in `SCORECARD.md` in the same change.

## Commands

```bash
bun install
bun run check                                              # lint, typecheck, test, build everywhere
bun run --cwd templates/saas-starter dev                   # work on the template
bun run --filter create-tanstack-cf-saas test:matrix       # prove every feature combination
node apps/cli/dist/index.js my-app --features db,auth      # try the CLI (after bun run build)
```

## Claude harness

`claude/` holds the files the CLI ships. Its bundle copies them into each new project's `.claude/`
and records a hash per file in `harness.lock.json`; `create-tanstack-cf-saas harness check|sync`
compares and refreshes it. They are plain files in this repo, not a submodule.

The skills and agents for work on this repo live in the Home Repo, `claude-config`, which points
here. Start sessions there.

## Releasing

`staging` is the default branch; `production` takes only a pull request from `staging` whose last
commit has a `v*` tag (`.github/rulesets/`, applied with `create-tanstack-cf-saas github`). Stack
small pull requests on each other: they get `pr.yml`; the one into `staging` gets `check.yml`.
`templates/saas-starter/docs/branches.md` draws the flow and says why each rule is there.

`bun run changeset` to describe a change, then merge. On `staging`, `release.yml` opens the version
pull request; on `production` it publishes `packages/*` and the CLI under the `@tanstack-cf-saas`
npm scope (claim it before the first publish).

`RELEASING.md` has the steps: merge the version pull request, `bun run promote`, merge the promotion
with a merge commit. `/release` has Claude follow it.
