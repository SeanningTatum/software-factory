<!-- generated:start -->
<!-- Written by `cf-saas-blocks sync` from feature.json and the source. Edits here are lost. -->

# Auth emails (`auth-email`)

What auth does with email, through Better Auth's emailOTP plugin: a code to verify the address at sign-up, to reset a password, and to sign in without one.

- Kind: feature, auto; on whenever auth and email and email-templates are, and removed with either
- Depends on: [auth](../auth/TIMELINE.md), [email](../core/email/TIMELINE.md), [email-templates](../core/email-templates/TIMELINE.md)
- Used by: none
- Bindings: none
- Vars: none
- Secrets: none
- Also owns: none
- Feeds: `src/gen/nav.ts`, `src/gen/auth-plugins.ts`, `src/gen/routes.ts`
- Routes: `/forgot-password`, `/sign-in-code`, `/verify-email`
- Services: none
- Errors: none
- Events: none
- Machines: `components/code.machine.ts`. Diagrams under Machines, from `bun run machines:print`.
<!-- generated:end -->

<!-- machines:start -->

## Machines

Written by `bun run machines:print`. `bun run test` fails when a diagram is out of date.

### code

Source: `src/features/auth-email/components/code.machine.ts`

```mermaid
stateDiagram-v2
  [*] --> start
  start --> code : always
  start --> email : always
  email --> requesting : REQUEST
  requesting --> code : done: 0.code.requesting
  requesting --> email : error: 0.code.requesting
  code --> confirming : CONFIRM
  code --> requesting : RESEND
  confirming --> done : done: 0.code.confirming
  confirming --> code : error: 0.code.confirming
  done --> [*]
```

<!-- machines:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

- 2026-11-27 — An `auto` feature: nobody chooses it; it is on exactly when `auth` and `email` both are, and leaves with either. Why: auth must work without email and email without auth, and auth can't import a module that may be absent.
- 2026-11-27 — Everything goes through Better Auth's `emailOTP` plugin, added from `auth-plugins.ts`: an 8-digit code verifies the address at sign-up, resets a password and signs in. No links. Why: one plugin covers all three, and a code leaves no token in a URL, a browser history or a server log.
- 2026-11-27 — With this feature on, sign-in waits for a verified address (`requireEmailVerification`, set by the `require-verified-email` plugin's `init`), and a sign-in before that sends a fresh code. Why: nobody should hold an account under an address they don't own.
- 2026-11-27 — The plugins stay off until the `EMAIL` binding and `EMAIL_FROM` are both set; auth then works as it does without email. Why: requiring a verified address with no way to send the code would lock everyone out.
- 2026-11-27 — A code for an address with no account sends nothing and makes no account (`disableSignUp`), and the page says the same thing either way. Why: sign-up has a Turnstile check a code would skip, and the answer must not reveal who has an account.
- 2026-11-27 — Codes are stored hashed, last 5 minutes and allow 3 tries; the code paths are in auth's `CODE_PATHS`, limited per address like sign-in and per account under `code:<email>`, refused past it. Why: a per-address limit alone lets an attacker who rotates addresses guess codes or fill an inbox; a separate key keeps that from spending the password sign-in limit.
- 2026-11-27 — A reset by code signs the account out everywhere (`revokeSessionsOnPasswordReset`). Why: a reset is how an owner locks out whoever has their password; the session cookie cache keeps an old session alive for up to five minutes.
- 2026-11-27 — The verify page gets the address in the router's history state, never in the URL, and asks for it when there is none (a reload, a typed URL). Why: an address in a URL ends up in browser history, logs and page-view analytics.
- 2026-11-27 — A send that fails still answers success, and logs the warning `code mail not sent` with Email Service's error code. Why: Better Auth runs the send in the background and swallows its error, and an error shown only for real accounts would reveal who has one. `docs/runbook.md` says what each code means.
- 2026-11-27 — The three pages share one `code` machine and form. Why: each is "give an email, get a code, confirm it"; only the last call differs.
- 2026-11-27 — Auth's pages find these through `nav.ts` entries marked `sign-in-help` and `verify-email`. Why: the login and sign-up pages belong to auth, which can't import this feature.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->
