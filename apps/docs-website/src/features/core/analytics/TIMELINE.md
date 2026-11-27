<!-- generated:start -->
<!-- Written by `software-factory-blocks sync` from feature.json and the source. Edits here are lost. -->

# Analytics (`analytics`)

A typed event catalog, an Analytics service with console, PostHog and Analytics Engine adapters, the browser helpers that send page views and web vitals, and /api/events.

- Kind: core module, required; it can't be removed
- Depends on: none
- Used by: none
- Bindings: `EVENTS_LIMITER` (ratelimit)
- Vars: `ANALYTICS_PROVIDER`, `POSTHOG_HOST`
- Secrets: `POSTHOG_KEY`
- Also owns: none
- Feeds: `src/gen/layers.ts`, `src/gen/errors.ts`, `src/gen/events.ts`, `src/gen/routes.ts`
- Routes: `/api/events`
- Services: `Analytics`
- Errors: `AnalyticsDeliveryError`
- Events: `page_viewed`, `user_identified`, `web_vital`
- Machines: none
<!-- generated:end -->

## Decisions

<!-- Newest first, one line each: - YYYY-MM-DD — <decision>. Why: <reason>. (<commit sha or PR URL>) -->

- 2026-11-24 — Each feature's `events.ts` exports `metric`, its success measure and the events behind it; `catalog.test.ts` fails when one is missing or names an event outside the catalog. Why: a metric nobody can measure is a guess.
- 2026-11-24 — `user_identified` is server-only and the PostHog adapter sends it as `$identify` with `$anon_distinct_id`. Why: PostHog merges the visitor into the user only on its own event; the other adapters keep it as a row to join on.
- 2026-11-24 — `/api/events` is rate-limited per address by the `EVENTS_LIMITER` binding (60 a minute), reads at most 16 KB as it arrives, and attributes events to the signed-in user, else the consented `aid` cookie. Why: anyone could pump unlimited events into the provider, and each event counted as a new anonymous person.
- 2026-11-24 — The browser tracker lives in `consent`, not here. Why: it has logic of its own and waits on consent, and a core module holds services or components, never both.
- 2026-11-24 — Every event is a `Schema.TaggedStruct` in some feature's `events.ts`; `src/gen/events.ts` gathers them and `capture` takes only those. Why: an event outside the catalog does not type-check.
- 2026-11-24 — Events hold no personal data, and `lib/catalog.test.ts` fails on property names such as email, name, ip or phone. Why: events may leave for a third party, and personal data must not go with them.
- 2026-11-24 — A missing key or binding swaps in a no-op adapter, and a failed delivery is logged and dropped. Why: analytics must never break a request.
- 2026-11-24 — Events queue during a request and go out as one batch when it ends. Why: one outside call per request, sent after the response work is done.
- 2026-11-24 — Browser events post to our own `/api/events` (16 KB, 20 events, Schema-checked), and PostHog is called with fetch, not its SDK. Why: no third-party host joins the CSP and nothing joins the bundle.
- 2026-11-24 — The browser tracker sends page views and web vitals only after consent. Why: the browser needs consent to track; server events do not depend on it.

## History

<!-- Newest first, one line each: - YYYY-MM-DD — <what changed>. (<commit sha or PR URL>) -->

- 2026-11-27 — Created from create-tanstack-cf-saas 0.1.0.
