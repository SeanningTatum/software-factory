#!/bin/sh
# Self-check for promote.sh, run by `bun run check`. It uses a throwaway origin, so nothing leaves
# this machine.
set -eu
script=$(cd "$(dirname "$0")" && pwd)/promote.sh
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null \
  GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

cd "$tmp"
git init -q --bare origin.git
git init -q -b staging work
cd work
git remote add origin ../origin.git
mkdir -p .changeset apps/cli
echo readme > .changeset/README.md
printf '{\n  "name": "cli",\n  "version": "1.2.3",\n  "private": true\n}\n' > apps/cli/package.json
git add .
git commit -qm init
git push -q origin staging staging:production

# expect ok|fail <text the output must hold> [promote.sh arguments]
expect() {
  want=$1 text=$2
  shift 2
  got=ok
  out=$(sh "$script" "$@" 2>&1) || got=fail
  if [ "$got" != "$want" ] || ! printf '%s' "$out" | grep -q "$text"; then
    printf 'promote.sh %s: wanted %s with "%s", got %s:\n%s\n' "$*" "$want" "$text" "$got" "$out" >&2
    exit 1
  fi
}
tags() { git ls-remote --tags origin | sed 's|.*refs/tags/||'; }

expect fail "Nothing to release"

echo change > .changeset/a.md
git add .
git commit -qm changeset
git push -q origin staging
expect fail "unversioned changesets"

git rm -q .changeset/a.md
git commit -qm version
git push -q origin staging
expect fail "must start with v" 9.9.9
[ -z "$(tags)" ]

head() { git ls-remote origin "refs/heads/$1" | cut -f1; }

expect ok "Promoted v1.2.3"
[ "$(tags)" = v1.2.3 ]
[ "$(head production)" = "$(head staging)" ]
expect fail "Nothing to release"

# The tip moves and the CLI's version does not: the name is taken, another tags the new tip.
git commit -q --allow-empty -m late
git push -q origin staging
expect fail "already exists"
expect ok "Promoted v1.2.4" v1.2.4
[ "$(tags | wc -l)" -eq 2 ]

# Production with a commit of its own cannot fast-forward: the push is refused, never forced.
git commit -q --allow-empty -m next
git push -q origin staging
git push -q origin "$(git commit-tree -p origin/production -m stray 'HEAD^{tree}'):refs/heads/production"
stray=$(head production)
expect fail "production did not move" v9
[ "$(head production)" = "$stray" ]

# With production gone, the next run reuses the tag the refused one left and makes the branch.
git push -q origin --delete production
expect ok "Promoted v9"
[ "$(head production)" = "$(head staging)" ]

echo "promote.sh: ok"
