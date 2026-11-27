<!-- generated:start -->
<!-- Written by `software-factory-blocks sync` from feature.json and the source. Edits here are lost. -->

# Email templates (`email-templates`)

The one look every mail shares, as React Email components (layout, text, button, code), and renderMail, which turns a mail into the HTML and plain text Email.send takes.

- Kind: core module, auto; on whenever email are, and removed with either
- Depends on: [email](../email/TIMELINE.md)
- Used by: [auth-email](../../auth-email/TIMELINE.md)
- Bindings: none
- Vars: none
- Secrets: none
- Also owns: none
- Feeds: none
- Routes: none
- Services: none
- Errors: none
- Events: none
- Machines: none
<!-- generated:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->
- 2026-11-27 — Mails are React Email components, and every one wraps itself in `MailLayout`. Why: mail clients need table-based HTML with inline styles, which nobody should write by hand, and one layout keeps every mail looking like one product.
- 2026-11-27 — `renderMail` makes the text part from the HTML. Why: two hand-written parts drift apart, and a mail with no text part scores worse with spam filters.
- 2026-11-27 — `renderMail` is React's own `renderToStaticMarkup` plus `html-to-text`, not `@react-email/render`. Why: that package pulls prettier into the Worker, about 90 kB gzipped; the Worker already has React's renderer.
- 2026-11-27 — Styles are inline constants in `mail.tsx`, not Tailwind. Why: React Email's Tailwind component bundles the Tailwind compiler into the Worker; four components don't need it.
- 2026-11-27 — A components-only core module, `auto` with `email`: on whenever `email` is. Why: `email` is a services module and may hold no React, and a project with no email should not carry a mail layout or its packages.
- 2026-11-27 — A feature keeps its own mails beside its code and imports only the layout from here. Why: a mail belongs to the flow that sends it, and leaves with that feature.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->
