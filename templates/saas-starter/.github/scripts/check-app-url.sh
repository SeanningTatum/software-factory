#!/bin/sh
# Passes when the GitHub variable holding an environment's URL is that environment's APP_URL in
# wrangler.jsonc. /api/health answers 503 under any other URL, so a deploy with the two apart
# fails its smoke test and rolls back. Run it from the project's root, before anything moves.
# Usage: check-app-url.sh <staging|production> <the variable's value>
set -eu
env=$1
url=$2
if [ "$env" = production ]; then var=PRODUCTION_URL; else var=STAGING_URL; fi
# Bun reads JSONC as it imports it. An env's vars replace the top level's, so staging has its own.
# Origins, as /api/health compares them: case and a trailing slash do not count.
out=$(ENV_NAME=$env GIVEN=$url bun -e '
  const config = (await import(`${process.cwd()}/wrangler.jsonc`)).default;
  const name = process.env.ENV_NAME;
  const app = String(((name === "production" ? config : config.env?.[name])?.vars ?? {}).APP_URL ?? "");
  const origin = (u) => URL.parse(u)?.origin;
  console.log(app && origin(app) === origin(process.env.GIVEN) ? "same" : "differ", app);
')
[ "${out%% *}" = same ] && exit 0
app=${out#* }
echo "::error::$var is ${url:-empty}, but $env's APP_URL in wrangler.jsonc is ${app:-empty}. /api/health answers 503 until they match. To move to ${url:-the new URL}: bunx create-tanstack-cf-saas setup --env $env --var APP_URL=${url:-https://...}, then merge wrangler.jsonc into staging. To stay on ${app:-its APP_URL}: bunx create-tanstack-cf-saas github."
exit 1
