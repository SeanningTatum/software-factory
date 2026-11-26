#!/bin/sh
# Says where production stands after a deploy or a rollout step: a table on the run's summary
# page and, when the POSTHOG_KEY secret is set, a `deployment_rolled_out` event beside the app's
# own events, which carry the same `app_version`.
# Usage: report-rollout.sh <tag> <percent of traffic on that tag>
set -eu
tag=$1
percent=$2
{
  echo "### Production: $tag serves $percent% of traffic"
  echo
  echo "| Version | Traffic |"
  echo "| --- | --- |"
  bunx wrangler deployments status --json |
    jq -r '.versions[] | "| `\(.version_id)` | \(.percentage)% |"'
} >> "$GITHUB_STEP_SUMMARY"

[ -n "${POSTHOG_KEY:-}" ] || exit 0
# No person profile: the sender is this workflow, not a visitor.
jq -n --arg key "$POSTHOG_KEY" --arg tag "$tag" --argjson percent "$percent" '{
  api_key: $key,
  batch: [{
    event: "deployment_rolled_out",
    distinct_id: "deploy",
    properties: { app_version: $tag, percent: $percent, "$process_person_profile": false }
  }]
}' |
  curl -sS --fail-with-body --max-time 10 -X POST -H 'Content-Type: application/json' -d @- \
    "${POSTHOG_HOST:-https://us.i.posthog.com}/batch/" ||
  echo "::warning::PostHog did not take the deployment event."
