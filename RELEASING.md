# Releasing

A release publishes five packages to npm: the CLI, `@seanningtatum/create-software-factory`, and the four under
`@seanningtatum/software-factory-` (`biome-config`, `tsconfig`, `lint`, `blocks`). The template ships inside the
CLI. Code moves `staging` → `production`; only `production` publishes. A release adds no commit:
`production` moves to the commit `staging` is on, so both branches share one head and every tag of
a release sits on it.

## With every change

```bash
bun run changeset
```

Pick the packages you touched and the bump, and write one line a user would understand. That line
becomes the changelog and the GitHub release note, so no one writes release notes by hand. A change
to the template alone needs a changeset for the CLI, which carries it.

## Ship a release

| Step | Do                                                          | What happens                                                    |
| ---- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| 1    | Merge the "Version Packages" pull request into `staging`.   | Versions are bumped, changelogs written, changesets spent.      |
| 2    | Wait for `check.yml` and `blocks.yml` to pass on `staging`. | `production` takes only a commit the checks passed on.          |
| 3    | `bun run promote`, or Actions → promote → Run workflow.     | Tags `staging`'s tip, moves `production` to it; that publishes. |
| 4    | `npm view @seanningtatum/create-software-factory version`   | Shows the version you just shipped.                             |

The tag is `v<the CLI's version>`, as in `v0.1.0`; `release.yml` publishes to npm and makes the
GitHub releases. Nothing merges into `production`: no pull request, no merge commit, never a
force-push. `/release` has Claude do all four and ask before the merge and before the promotion.

## Set up once

- **npm scope.** None to create: the packages publish under `@seanningtatum`, the owner's own scope, and the
  CLI as `@seanningtatum/create-software-factory`: npm refuses the unscoped name as too like `create-softwarefactory`. A release from another npm account needs its own scope.
- **`NPM_TOKEN`.** On npmjs.com make a granular access token: read and write, all packages, bypass
  two-factor. Then run `gh secret set NPM_TOKEN` and paste it at the prompt. It expires in at most
  90 days; renew it the same way.
- **Version pull requests.** Settings → Actions → General → "Allow GitHub Actions to create and
  approve pull requests". Without it, open each one by hand:
  `gh pr create --base staging --head changeset-release/staging --title "chore(release): version packages"`.
- **Docs site.** `docs.yml` deploys `apps/docs-website` to Cloudflare: each push to `staging` to
  the `docs-website-staging` Worker, each promotion to `docs-website`. The first deploy creates
  them. In the Cloudflare dashboard make an API token from the "Edit Cloudflare Workers" template,
  then run `gh secret set CLOUDFLARE_API_TOKEN` and paste it, and
  `gh variable set CLOUDFLARE_ACCOUNT_ID --body <account id>`. Until that variable is set the job
  is skipped. The smoke test calls the domain named in
  `apps/docs-website/wrangler.jsonc`: `staging.createsoftwarefactory.dev` and
  `createsoftwarefactory.dev`. It fails on a redirect, so while Cloudflare Access guards a domain,
  make an Access service token, allow it in a Service Auth policy, and set it with
  `gh secret set DOCS_ACCESS_CLIENT_ID` and `gh secret set DOCS_ACCESS_CLIENT_SECRET`.
- **Branch rules.** Applied from `.github/rulesets/`. After you edit one, find its id with
  `gh api 'repos/{owner}/{repo}/rulesets'` and send it:
  `gh api --method PUT 'repos/{owner}/{repo}/rulesets/<id>' --input .github/rulesets/<file>`.

## When it goes wrong

| You see                                                   | Do this                                                                                                                                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The version pull request's checks are missing or stale.   | Close and reopen it. A push by Actions starts no checks.                                                                                                                      |
| `promote` says "unversioned changesets".                  | Do step 1 first.                                                                                                                                                              |
| `promote` says "production did not move".                 | `check.yml` or `blocks.yml` has not passed on `staging`'s tip: wait, or fix it, then run it again.                                                                            |
| The same, and git says "non-fast-forward".                | `production` has a commit `staging` lacks. Rebuild it: see below.                                                                                                             |
| `git tag` says the tag exists.                            | The CLI's version did not change. Pass a name: `bun run promote v0.1.1`.                                                                                                      |
| `release.yml` fails at "On staging, with a version tag".  | `production` moved without `bun run promote`. Tag that commit `v…`, re-run the job.                                                                                           |
| A release leaves the CLI out, or npm refuses its `0.2.0`. | `0.2.0` was used on 2026-11-26 and npm never frees a number. Set the CLI to `0.2.1` in the version pull request.                                                              |
| Publish fails with 401 or 403.                            | The token expired or lacks the scope. Replace `NPM_TOKEN`, re-run the job.                                                                                                    |
| `docs.yml` fails its smoke test.                          | On production it rolled back, and the npm release still went out; on staging the broken version stays up until the next push. Read the job's `/api/health` answer and fix it. |
| Publish failed part way.                                  | Re-run the job. It skips versions already on npm.                                                                                                                             |
| A bad version is live.                                    | Fix forward with a new release. `npm deprecate` the bad one; never unpublish.                                                                                                 |

**Rebuilding `production`.** If a commit ever lands on `production` first, the branches cannot share
a head again until it is gone. In the `production` ruleset turn off "Restrict deletions", delete the
branch, run `bun run promote` (it makes the branch at `staging`'s tip), and send the ruleset again as
"Branch rules" above says.
