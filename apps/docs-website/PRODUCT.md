# Product

<!-- impeccable:product-schema 1 -->

Source of truth: `docs/product/FOUNDATION.md` at the repo root (agreed 2026-11-27). This file is its
short form for design work; when they differ, the foundation wins.

## Platform

web

## Users

A solo developer, alone at a laptop with a new idea, building their own SaaS ideas and client work.
They want a factory to start from: set up once, reuse for every idea. Today they start blank, from
create-t3-app or a template, and invoke skills and plugins by hand.

## Product Purpose

Software Factory builds a SaaS for Cloudflare Workers from blocks (database, sign-in, billing, key
value store, uploads, background jobs), wires the picked ones together, tests them and can deploy
the result. Each project also gets workflows for Claude Code. Success by 27 February 2027: 150
GitHub stars, 5 outside repos, 3 of our own client projects started from it.

## Positioning

A whole factory, not single skills: one command gives a project with only the features picked, the
gates that hold it to a standard, and the workflows that make existing skills and plugins work
together. Cloudflare only. Free and open source; never a hosted or paid version.

## Operating Context

The terminal (`bunx @seanningtatum/create-software-factory my-app --features db,auth`), Claude Code,
wrangler, GitHub. The docs site is at createsoftwarefactory.dev.

## Capabilities and Constraints

- CLI commands: `create`, `add`, `remove`, `setup`, `github`, `harness`.
- Required blocks: observability, analytics, ui, consent, home. Optional: db, kv, auth, billing,
  workflows, uploads.
- Every feature combination is proven by a feature matrix that runs every gate.
- Not affiliated with Cloudflare.
- Open: whether vibe coders and business people are users.

## Brand Commitments

- Name: Software Factory (confirmed 2026-11-28).
- Feel: simple, composable, succinct. Never complex, bloated or too much.
- Dark first, with a light and dark toggle. Futuristic; the finish of linear.app.
- Typefaces: free and open licensed only, self-hosted, and its own, not the faces every developer
  site uses.
- Craft references, not worlds to copy: fumadocs.dev (favourite), zed.dev, prisma.io, linear.app
  (its line illustrations), raycast.com/new.

## Evidence on Hand

- The real CLI and its commands, the feature list, the gates, the feature matrix, the docs.
- No customers, testimonials, star counts or benchmarks yet. Do not invent any.

## Product Principles

1. Workflows, not skills: ship how existing tools work together, make nothing new.
2. Only what you picked: a project holds the chosen features and nothing else.
3. Proven, not promised: every combination passes the gates before it ships.
4. One host: Cloudflare, so local and production share one API.
