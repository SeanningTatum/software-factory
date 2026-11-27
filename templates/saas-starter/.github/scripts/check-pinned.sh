#!/bin/sh
# Passes when one version answers every request from this machine. In a gradual rollout that takes
# the rule in docs/branches.md, which pins an address to one version. Without it Cloudflare picks
# a version for each request, and a page from one version asks the other for scripts it lacks.
# Usage: check-pinned.sh <url>
# shortcut: 100 requests a round, so under a 5% share a missing rule often passes; start at 5 or more, or raise the count.
set -eu
for _ in 1 2 3; do
  # A new split takes a few seconds to reach every edge, and moves some addresses as it lands.
  sleep 10
  seen=$(curl -4 -sS -f --max-time 15 -Z --parallel-max 20 "$1/api/health?[1-100]" |
    jq -r '.version.id' | sort -u | wc -l | tr -d ' ')
  echo "$seen version(s) answered"
  [ "$seen" = 1 ] && exit 0
done
exit 1
