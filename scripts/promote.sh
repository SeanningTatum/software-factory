#!/bin/sh
# Promote staging to production: tag staging's tip, then open the pull request promote.yml gates.
# Merging that pull request (a merge commit) makes release.yml publish to npm.
#   bun run promote [tag]     the tag defaults to today's date, e.g. v2026.11.25
set -eu

git fetch --quiet --tags origin

# release.yml cannot open a version pull request into production; the ruleset refuses it.
if git ls-tree -r --name-only origin/staging .changeset | grep -v README.md | grep -q '\.md$'; then
  echo "staging has unversioned changesets. Merge the Version Packages pull request first." >&2
  exit 1
fi
if [ "$(git rev-list --count origin/production..origin/staging)" = 0 ]; then
  echo "Nothing to release: production already has staging's tip." >&2
  exit 1
fi

# A tag already on the tip is reused, so a second run only opens the pull request.
tag=$(git tag --points-at origin/staging --list 'v*' | head -n 1)
if [ -z "$tag" ]; then
  tag=${1:-v$(date +%Y.%m.%d)}
  case $tag in
    v*) ;;
    *) echo "The tag must start with v: promote.yml looks for v*." >&2; exit 1 ;;
  esac
  # Fails when the name is taken, as on a second release in one day: pass another, v2026.11.25.2.
  git tag "$tag" origin/staging
  git push origin "$tag"
fi

# After a new tag on a moved tip the pull request is already there: say so, don't fail.
open=$(gh pr list --base production --head staging --json url --jq '.[0].url')
if [ -n "$open" ]; then
  echo "Tagged $tag. The promotion is already open: $open"
  exit 0
fi

gh pr create --base production --head staging --title "Release $tag" \
  --body "Promotes \`staging\` at $(git rev-parse --short origin/staging) to \`production\`. Merge with a merge commit, never a squash: the push publishes \`packages/*\` and the CLI to npm."
