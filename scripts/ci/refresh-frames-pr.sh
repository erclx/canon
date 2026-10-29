#!/usr/bin/env bash
# Commits the recaptured home baseline onto the refresh branch and opens or
# updates its pull request, called by refresh-capture-frames.yml after the
# capture step. The step holds GH_TOKEN and HUSKY, since the token scope is
# read off the workflow.
#
# Hooks stay off, since pre-push runs a check whose format step needs shfmt,
# which the runner lacks. verify.yml checks the pull request.
#
# The baseline commits where they rendered, then only the files that commit wrote
# or dropped carry onto main fetched now, so a merge landing mid-run neither
# leaves the branch on an older base nor loses a baseline frame it moved. The pull
# request resolves by number, since every merged refresh leaves a closed one on
# the same head.
set -e

branch=chore/refresh-capture-frames
title="chore(web): refresh home baseline"

if [ -z "$(git status --porcelain assets/evidence)" ]; then
  echo "The home baseline is current, nothing to refresh."
  exit 0
fi
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com" # canon-allow-reference: the bot account id, not a commit
git add assets/evidence
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
if git diff --cached --quiet -- assets/evidence; then
  echo "Main already carries this baseline, nothing to refresh."
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

- Refreshes the home page baseline from main so canon pr evidence compares against a current render.

## Key changes

- Recaptures the home page baseline under assets/evidence/home.
- Merges itself by squash once its required check passes."
  number=$(gh pr list --head "$branch" --state open --json number --jq '.[0].number')
fi
# Every run, so a force-push from a later run leaves it queued either way
gh pr merge "$number" --auto --squash
