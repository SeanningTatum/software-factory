<!-- generated:start -->
<!-- Written by `software-factory-blocks sync` from feature.json and the source. Edits here are lost. -->

# Email (`email`)

Transactional email through Cloudflare Email Service, as an Effect Email service over the send_email binding. With auth, adds password reset, email verification and sign-in by code.

- Kind: core module, optional; `software-factory-blocks remove email` takes it out
- Depends on: none
- Used by: [auth-email](../../auth-email/TIMELINE.md), [email-templates](../email-templates/TIMELINE.md)
- Bindings: `EMAIL` (send_email)
- Vars: `EMAIL_FROM` (required)
- Secrets: none
- Also owns: none
- Feeds: `src/gen/layers.ts`, `src/gen/errors.ts`
- Routes: none
- Services: `Email`
- Errors: `EmailError`
- Events: none
- Machines: none
<!-- generated:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

- 2026-11-27 — Mail goes through Cloudflare Email Service's `send_email` binding, with no API key and no second provider. Why: the app already runs on Workers, and `wrangler dev` simulates the binding, logging each mail instead of sending it.
- 2026-11-27 — Every mail is sent from `EMAIL_FROM`; callers pass only `to`, `subject`, `text` and `html`. Why: the sender must be on the onboarded domain, and a mail with no text part scores worse with spam filters.
- 2026-11-27 — Without the `EMAIL` binding or `EMAIL_FROM` the layer still builds and `send` fails with `NotConfigured`. Why: the rest of the app keeps working, and the error names what is missing.
- 2026-11-27 — Lives in `src/features/core/` as a services-only module and stays optional; what auth does with it is the `auth-email` feature. Why: email is useful without auth, and auth must work without email.
- 2026-11-27 — Transactional mail only. Why: Cloudflare Email Service forbids marketing and bulk sends.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->
