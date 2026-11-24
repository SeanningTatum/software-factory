# Scorecard

Where the template stands against the twelve areas in
[the v3.0 plan](https://github.com/SeanningTatum/cf-saas-starter-react-router/issues/58), each
scored 1 to 5. The plan's rule: a score is a check that runs. So each row names the checks that run
today and what is still missing. A score with no check behind it is a guess and is marked so.

Last scored: 2026-11-24, after the audit fixes. Update a row in the same change that adds or removes its check.

| Area                      | Start | Now         | Checks that run today                                                                                                                                                                   | Missing for 5                                                                              |
| ------------------------- | ----- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Logging                   | 2     | 4           | `noConsole` in Biome; `external-call-span` in `cf-saas-lint`; unit tests for the request id, user, redaction and error reporter                                                         | Audit trail, alerts, runbook                                                               |
| Analytics                 | 1     | 4           | Unit tests for the event catalog, adapters and consent; a test that fails on personal data in event properties                                                                          | Identity across sessions; a gate that each feature's metric has events                     |
| Code structure for agents | 4     | 4           | `feature-layout` and import boundaries (`cf-saas-blocks check`); knip; Biome; `tsc` over source and e2e; stale `FEATURES.md` or `TIMELINE.md` fails                                     | The template's `CLAUDE.md` is 88 lines, over the 80 limit; no check on its length or truth |
| Testing                   | 2.5   | 3.5         | Sibling-test rule (`test-map`); real-SQL tests; a test and a path spec per UI machine; Playwright with no retries                                                                       | A golden and an error spec for every route; coverage floors                                |
| Quality checks            | 3     | 3           | Lint, format, dead code, unused packages, feature boundaries, timeline gate, all in `bun run check` and CI                                                                              | Bundle size, accessibility, migration drift, secret and vulnerability scans, coverage      |
| Security                  | 2     | 3.5         | Unit tests for security headers, the nonce CSP, upload magic bytes, a byte cap on every request body, and rate limits on auth, uploads and the public event endpoints; `no-process-env` | CSRF middleware (Start warns on each dev start), audit log, scanning in CI, Turnstile      |
| Deployment                | 2     | 2.5 (guess) | None has run. `deploy.yml` holds staging, approval, production, a smoke test and rollback; `/api/health` now fails on a missing required setting, a wrong `APP_URL` or a dead database  | A green run; gradual rollout, backups, runbook                                             |
| Bundle size               | 3     | 2           | knip flags unused packages                                                                                                                                                              | Budgets in CI for `/`, `/login` and the Worker                                             |
| Human in the loop         | 3     | 1           | The production environment approval in `deploy.yml`                                                                                                                                     | The brief and ship stops, set by policy; they belong to the harness                        |
| Agentic workflows         | 3     | 1           | None                                                                                                                                                                                    | `claude/` is a placeholder until the shared repo is added                                  |
| Code review               | 3     | 1           | None                                                                                                                                                                                    | Required checks on GitHub, reviewers, findings filed and closed                            |
| Smartness checks          | 2     | 1           | None                                                                                                                                                                                    | Evals for prompts that judge; needs the harness                                            |

## Reading it

- The six areas about the template's own code sit at 3 to 4.
- The four lowest areas all wait on the real `claude` repo. All four score below their start
  because the old repo had a working harness and this one has a placeholder.
- Deployment stays a guess until a pipeline runs green. That needs GitHub Actions billing fixed and
  a Cloudflare token.

## Next

The open work is in [BACKLOG.md](BACKLOG.md), in order.
