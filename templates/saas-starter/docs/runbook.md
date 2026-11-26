# Runbook

What to do when production breaks. Skip a section if your project lacks the feature it names.

## Before you need it

- Set `ALERT_WEBHOOK_URL` (a Slack or Discord incoming webhook) with
  `bunx wrangler secret put ALERT_WEBHOOK_URL`. The first error of a burst posts there with its
  request id; then the Worker stays quiet for five minutes.
- Set `ERROR_REPORTER=sentry` and `SENTRY_DSN` if you want each error kept and grouped.
- Workers Logs is on in `wrangler.jsonc` (`observability.enabled`). Cloudflare keeps those logs
  3 days on the Free plan and 7 on Workers Paid, then deletes them. Past that, only the export
  below has them.
- Set the repository secret `ALERT_WEBHOOK_URL` (the same webhook) so a failed production deploy
  posts there too. Without it the deploy step does nothing extra.
- Responses of 500 or more that never reach the reporter (the Worker dies before it runs) send no
  alert. Point a free uptime monitor at `/api/health`, which answers 503 when the app is unwell.

## Keep logs past a week

`wrangler.jsonc` sets `"logpush": true`, which marks the Worker for Workers Logpush. It sends
nothing until you create a job once per account. This needs the Workers Paid plan. Cloudflare
bills Logpush per request logged, and R2 storage is billed as usual; nothing is kept in
Cloudflare's own store beyond the days above.

1. Create an R2 bucket (`bunx wrangler r2 bucket create <bucket>`) and an R2 API token with
   write access to it.
2. Create the job, with an API token that has the account permission Logs Edit. Read the
   tokens into variables first (`read -s API_TOKEN`, and the same for the R2 keys) so they stay out
   of your shell history, and revoke the Logs Edit token afterwards:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/logpush/jobs" \
  --header "Authorization: Bearer $API_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "name": "workers-logpush",
    "dataset": "workers_trace_events",
    "enabled": true,
    "output_options": { "field_names": ["Event", "EventTimestampMs", "Outcome", "Exceptions", "Logs", "ScriptName"] },
    "destination_conf": "r2://<bucket>/{DATE}?account-id=<ACCOUNT_ID>&access-key-id='"$R2_ACCESS_KEY_ID"'&secret-access-key='"$R2_SECRET_ACCESS_KEY"'"
  }'
```

3. Redeploy. Files land in the bucket under one folder per day.

Logs stay in R2 until you delete them. Add an R2 lifecycle rule (bucket → Settings → Object
lifecycle rules) that expires objects after the time you want, for example 90 days. The app's
own log lines are redacted, but Cloudflare's `Event` field holds each request's URL, query string
included, so treat the bucket as private.

## Find a request

Every response carries `x-request-id`, and every log line and alert carries the same id as
`requestId`. In the Cloudflare dashboard open Workers → your Worker → Logs and search for it, or
run `bunx wrangler tail --search <request id>` while it happens again.

## A bad deploy

1. When GitHub Actions deploys (`deploy.yml`), production's smoke test calls `/api/health` and
   rolls back on its own when it fails. It posts to `ALERT_WEBHOOK_URL` first if that repo secret
   is set, so the alert goes out even if the rollback fails too. A deploy by hand runs no smoke
   test: call `/api/health` yourself.
2. If the damage shows later, roll back by hand: `bunx wrangler rollback -y`. This puts back the
   previous code only. The database stays as the new code left it.
3. Revert the commit on `staging`, so the next release does not ship it again, then release
   the revert.

## A failed migration (`db`)

1. Migrations run before the new code goes out, so a failed one stops the deploy and the old code
   keeps running. Read the error in the GitHub Actions log, or in your terminal after a deploy by
   hand.
2. Fix the migration in a new commit. Never edit one that has already run anywhere.
3. If a migration ran and damaged data, restore D1 to a minute before it:
   `bunx wrangler d1 time-travel restore DB --timestamp=<unix seconds>`. Roll back the code first
   if it needs the new shape.

## A Stripe outage (`billing`)

1. Check https://status.stripe.com. Checkout and the customer portal fail while Stripe is down;
   signed-in users keep their plan, because it is read from D1.
2. Webhooks that fail are answered with 500, so Stripe retries them for up to three days. Nothing
   to do unless the outage runs longer.
3. Afterwards, look under Developers → Webhooks in Stripe for events that never arrived, and resend
   them.

## Who did what (`auth`)

Sign-ups, sign-ins (failed ones too), sign-outs and plan changes each write a row to `audit_log`:
who (`actor_id`), what (`action`), when (`at`), the request id, address and browser. To read them:

```bash
bunx wrangler d1 execute DB --remote --command "SELECT * FROM audit_log WHERE actor_id = '<user id>' ORDER BY at DESC LIMIT 50"
```

Rows keep the address and browser after the user is deleted, and nothing prunes them. Decide how
long you keep them and say so in your privacy policy; to drop rows older than a year:

```bash
bunx wrangler d1 execute DB --remote --command "DELETE FROM audit_log WHERE at < (unixepoch('now', '-1 year') * 1000)"
```
