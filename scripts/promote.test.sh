#!/bin/sh
# Self-check for promote.sh, run by `bun run check`. It uses a throwaway origin and a stub gh, so
# nothing leaves this machine.
set -eu
script=$(cd "$(dirname "$0")" && pwd)/promote.sh
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

mkdir "$tmp/bin"
cat > "$tmp/bin/gh" <<'STUB'
#!/bin/sh
if [ "$2" = list ]; then echo "${OPEN_PR:-}"; else echo "gh $1 $2"; fi
STUB
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null \
  GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

cd "$tmp"
git init -q --bare origin.git
git init -q -b staging work
cd work
git remote add origin ../origin.git
mkdir .changeset
echo readme > .changeset/README.md
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

expect ok "gh pr create"
tag=$(tags)
case $tag in v20*) ;; *) echo "wanted a date tag, got '$tag'" >&2; exit 1 ;; esac

# From here the promotion is open. A second run reuses the tag and opens nothing.
export OPEN_PR=https://example.test/pull/1
expect ok "Tagged $tag. The promotion is already open"

# The tip moves: the old name is refused, a new one tags the new tip.
git commit -q --allow-empty -m late
git push -q origin staging
expect fail "already exists" "$tag"
expect ok "Tagged $tag.2. The promotion is already open" "$tag.2"
[ "$(tags | wc -l)" -eq 2 ]

echo "promote.sh: ok"
