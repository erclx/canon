#!/usr/bin/env bash
# Commits the regenerated capture frames onto the refresh branch and opens or
# updates its pull request, called by refresh-capture-frames.yml after the
# capture steps. The step holds GH_TOKEN and HUSKY, since the token scope is
# read off the workflow.
#
# Hooks stay off, since pre-push runs a check whose format step needs shfmt,
# which the runner lacks. verify.yml checks the pull request.
#
# The frames commit where they rendered, then only the files that commit wrote
# or dropped carry onto main fetched now, so a merge landing mid-run neither
# leaves the branch on an older base nor loses a frame it moved. The pull
# request resolves by number, since every merged refresh leaves a closed one on
# the same head.
set -e

branch=chore/refresh-capture-frames
title="chore(web): refresh capture frames"

if [ -z "$(git status --porcelain assets/captures assets/frames assets/evidence)" ]; then
  echo "Frames are current, nothing to refresh."
  exit 0
fi
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add assets/captures assets/frames assets/evidence
git commit -m "$title"
rendered=$(git rev-parse HEAD)
written=$(git diff --name-only --no-renames --diff-filter=d HEAD~1 HEAD)
dropped=$(git diff --name-only --no-renames --diff-filter=D HEAD~1 HEAD)
git fetch --depth=1 origin +refs/heads/main:refs/remotes/origin/main
git checkout -B "$branch" origin/main
if [ -n "$written" ]; then
  printf '%s\n' "$written" | xargs -d '\n' git checkout "$rendered" --
fi
if [ -n "$dropped" ]; then
  printf '%s\n' "$dropped" | xargs -d '\n' git rm -q --ignore-unmatch --
fi
if git diff --cached --quiet -- assets/captures assets/frames assets/evidence; then
  echo "Main already carries these frames, nothing to refresh."
  exit 0
fi
git commit -m "$title"
git push --force origin "$branch"
number=$(gh pr list --head "$branch" --state open --json number --jq '.[0].number')
if [ -z "$number" ]; then
  gh pr create \
    --base main \
    --head "$branch" \
    --title "$title" \
    --body "## Summary

- Refreshes the capture frames from main so their counts and tokens stay current.

## Key changes

- Regenerates the count and token bearing frames, their images, and their stamps from main.
- Recaptures the home page baseline under assets/evidence/home.
- Merges itself by squash once its required check passes."
  number=$(gh pr list --head "$branch" --state open --json number --jq '.[0].number')
fi
# Every run, so a force-push from a later run leaves it queued either way
gh pr merge "$number" --auto --squash
