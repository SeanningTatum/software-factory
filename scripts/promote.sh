#!/bin/sh
# Promote staging to production: tag staging's tip, then move production to that same commit.
# The push is a fast-forward and adds no commit, so both branches end on one head. It makes
# release.yml publish to npm.
#   bun run promote [tag]     the tag defaults to v<the CLI's version>, e.g. v0.1.0
set -eu

# --prune: a deleted production must not linger here as a stale origin/production.
git fetch --quiet --prune --tags origin
tip=$(git rev-parse origin/staging)

# release.yml cannot open a version pull request on production: staging is where versions are made.
if git ls-tree -r --name-only "$tip" .changeset | grep -v README.md | grep -q '\.md$'; then
  echo "staging has unversioned changesets. Merge the Version Packages pull request first." >&2
  exit 1
fi
# With no production yet (a new repository, or a rebuilt branch) the push below makes it.
if git rev-parse -q --verify origin/production >/dev/null &&
  [ "$(git rev-list --count "origin/production..$tip")" = 0 ]; then
  echo "Nothing to release: production already has staging's tip." >&2
  exit 1
fi

# A tag already on the tip is reused, so a run after a refused push only pushes again.
tag=$(git tag --points-at "$tip" --list 'v*' | head -n 1)
if [ -z "$tag" ]; then
  tag=${1:-v$(git show "$tip:apps/cli/package.json" | sed -n 's/^  "version": "\(.*\)",*$/\1/p')}
  case $tag in
    v*) ;;
    *) echo "The tag must start with v: release.yml looks for v*." >&2; exit 1 ;;
  esac
  # Fails when the name is taken, as when a release leaves the CLI's version alone: pass another.
  git tag "$tag" "$tip"
  git push origin "$tag"
fi

# No --force, ever: a refused push means a check has not passed or production has its own commit.
if ! git push origin "$tip:refs/heads/production"; then
  echo "Tagged $tag, but production did not move. If check.yml is still running on staging, wait and run this again. Otherwise see RELEASING.md." >&2
  exit 1
fi
echo "Promoted $tag: production and staging are both at $(git rev-parse --short "$tip"). release.yml is publishing."
