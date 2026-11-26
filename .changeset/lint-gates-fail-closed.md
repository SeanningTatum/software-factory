---
"@tanstack-cf-saas/lint": patch
---

Three gates no longer pass by mistake. `no-run-effect` sees Effect 4's `run…With` runners and a runner passed as a value (`xs.map(Effect.runSync)`), not only a call. `cf-saas-lint timeline --base <ref>` fails when git can't find `<ref>`, and `cf-saas-lint` fails when no file matches `include`; both used to pass on nothing. `file-size` no longer counts the final newline, so a file of exactly `maxLines` lines passes.
