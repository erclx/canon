#!/usr/bin/env bash
# Opens, updates, or closes one issue per stack from the outcomes stack-verify.yml
# recorded under results/<stack>, called by its report job. Takes the stacks as
# arguments and reads GH_TOKEN, GH_REPO, and RUN_URL from the step env.
set -euo pipefail

for stack in "$@"; do
  title="stack-verify: $stack"
  # A job that died before recording counts as a failure
  outcome=failure
  [ -f "results/$stack" ] && outcome=$(cat "results/$stack")
  number=$(gh issue list --state open --search "\"$title\" in:title" --json number,title \
    --jq "[.[] | select(.title == \"$title\")][0].number // empty")
  if [ "$outcome" = success ]; then
    if [ -n "$number" ]; then
      gh issue close "$number" --comment "Passing again in $RUN_URL"
    fi
  elif [ -n "$number" ]; then
    gh issue comment "$number" --body "Still failing in $RUN_URL"
  else
    gh issue create --title "$title" \
      --body "\`canon tooling verify $stack\` failed in $RUN_URL. The issue closes itself when a later run passes."
  fi
done
