#!/bin/sh
# Makes the Transform Rule a gradual rollout needs: on the app's host, every request gets the
# header Cloudflare-Workers-Version-Key, set to the visitor's address, so Cloudflare keeps that
# visitor on one version (docs/branches.md says why). Leaves the zone's other rules alone, and
# changes nothing when a rule for this host already sets the header.
# CLOUDFLARE_API_TOKEN needs Zone → Zone → Read and Zone → Transform Rules → Edit on the domain.
# Without them this warns and stops: a rule made by hand works as well, and check-pinned.sh
# tests the outcome either way.
# Usage: pin-visitors.sh <url>
set -eu
api=https://api.cloudflare.com/client/v4
header=Cloudflare-Workers-Version-Key
host=${1#*://}
host=${host%%[/:]*}
body=$(mktemp)
call() { curl -sS --max-time 15 -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$@"; }
skip() {
  echo "::warning::$1 Make the rule by hand (docs/branches.md), or give the token Zone → Zone → Read and Zone → Transform Rules → Edit."
  exit 0
}

# The zone is the host or a parent of it: app.example.com sits in example.com.
name=$host
zone=
while [ -z "$zone" ] && [ "${name#*.}" != "$name" ]; do
  zone=$(call "$api/zones?name=$name" | jq -r '.result[0].id // empty')
  [ -n "$zone" ] || name=${name#*.}
done
[ -n "$zone" ] || skip "The Cloudflare token cannot see the zone of $host."

# 404: the zone has no rule of this kind yet, so it has no ruleset for the phase either.
code=$(call -o "$body" -w '%{http_code}' "$api/zones/$zone/rulesets/phases/http_request_late_transform/entrypoint")
case $code in
  200 | 404) ;;
  *) skip "Cloudflare answered $code to reading the Transform Rules of $name: $(jq -c '.errors' "$body" 2> /dev/null)." ;;
esac
if [ "$code" = 200 ] && jq -e --arg host "$host" --arg header "$header" '
  any(.result.rules[]?;
    .enabled != false
    and (.expression == "true" or (.expression | contains("\"" + $host + "\"")))
    and any(.action_parameters.headers // {} | keys[]; ascii_downcase == ($header | ascii_downcase)))
' "$body" > /dev/null; then
  echo "Visitors of $host are pinned already: a Transform Rule sets $header."
  exit 0
fi

rule=$(jq -n --arg host "$host" --arg header "$header" '{
  description: "Pin each visitor of \($host) to one Worker version",
  expression: "(http.host eq \"\($host)\")",
  action: "rewrite",
  action_parameters: { headers: { ($header): { operation: "set", expression: "ip.src" } } }
}')
if [ "$code" = 200 ]; then
  # First in the list: a later rule of yours, such as a key from a user cookie, still wins.
  made=$(call -X POST -H 'Content-Type: application/json' \
    -d "$(printf '%s' "$rule" | jq '. + { position: { before: "" } }')" \
    "$api/zones/$zone/rulesets/$(jq -r '.result.id' "$body")/rules")
else
  made=$(call -X POST -H 'Content-Type: application/json' \
    -d "{\"name\":\"default\",\"kind\":\"zone\",\"phase\":\"http_request_late_transform\",\"rules\":[$rule]}" \
    "$api/zones/$zone/rulesets")
fi
# Here the rule is known to be missing, so a rollout would break pages: stop before it starts.
if [ "$(printf '%s' "$made" | jq -r '.success')" != true ]; then
  echo "::error::Could not make the Transform Rule on $name: $(printf '%s' "$made" | jq -c '.errors'). Give the token Zone → Transform Rules → Edit, or make the rule by hand: docs/branches.md."
  exit 1
fi
echo "Made the Transform Rule that pins each visitor of $host to one version."
