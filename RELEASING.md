# Releasing

A release publishes five packages to npm: `create-tanstack-cf-saas` and the four under
`@tanstack-cf-saas/` (`biome-config`, `tsconfig`, `lint`, `blocks`). The template ships inside the
CLI. Code moves `staging` → `production`; only `production` publishes.

## With every change

```bash
bun run changeset
```

Pick the packages you touched and the bump, and write one line a user would understand. That line
becomes the changelog and the GitHub release note, so no one writes release notes by hand. A change
to the template alone needs a changeset for the CLI, which carries it.

## Ship a release

| Step | Do                                                        | What happens                                               |
| ---- | --------------------------------------------------------- | ---------------------------------------------------------- |
| 1    | Merge the "Version Packages" pull request into `staging`. | Versions are bumped, changelogs written, changesets spent. |
| 2    | `bun run promote`                                         | Tags `staging`'s tip `v<date>`, opens the promotion.       |
| 3    | Merge the promotion with a **merge commit**.              | `release.yml` publishes and makes the GitHub releases.     |
| 4    | `npm view create-tanstack-cf-saas version`                | Shows the version you just shipped.                        |

`/release` has Claude do all four and ask before each merge.

## Set up once

- **npm scope.** Create the free npm organization `tanstack-cf-saas`.
- **`NPM_TOKEN`.** On npmjs.com make a granular access token: read and write, all packages, bypass
  two-factor. Then run `gh secret set NPM_TOKEN` and paste it at the prompt. It expires in at most
  90 days; renew it the same way.
- **Version pull requests.** Settings → Actions → General → "Allow GitHub Actions to create and
  approve pull requests". Without it, open each one by hand:
  `gh pr create --base staging --head changeset-release/staging --title "Version Packages"`.
- **Branch rules.** Applied from `.github/rulesets/`. After you edit one, find its id with
  `gh api 'repos/{owner}/{repo}/rulesets'` and send it:
  `gh api --method PUT 'repos/{owner}/{repo}/rulesets/<id>' --input .github/rulesets/<file>`.

## When it goes wrong

| You see                                                 | Do this                                                                                |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| The version pull request's checks are missing or stale. | Close and reopen it. A push by Actions starts no checks.                               |
| `promote` says "unversioned changesets".                | Do step 1 first.                                                                       |
| The `promote` check says "No version tag".              | Something merged after you tagged. Run `bun run promote` again, then re-run the check. |
| `git tag` says the tag exists.                          | Today's name is taken. Pass another: `bun run promote v2026.11.25.2`.                  |
| Publish fails with 401 or 403.                          | The token expired or lacks the scope. Replace `NPM_TOKEN`, re-run the job.             |
| Publish failed part way.                                | Re-run the job. It skips versions already on npm.                                      |
| A bad version is live.                                  | Fix forward with a new release. `npm deprecate` the bad one; never unpublish.          |
