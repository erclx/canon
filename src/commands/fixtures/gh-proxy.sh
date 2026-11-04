#!/usr/bin/env bash
# Fake gh that blocks GraphQL like the proxy, for src/commands/pr.test.ts. Reads FAKE_DIR.
set -o pipefail
fx="$FAKE_DIR"
echo "$*" >>"$fx/gh.log"
f=.
p=
for a in "$@"; do
  [ "$p" = --jq ] && f=$a
  p=$a
done
case "$*" in
*"/pulls/7/merge"*)
  [ -f "$fx/merge-409" ] && {
    echo '{"message":"Head branch was modified. Review and try the merge again."}'
    echo "gh: Head branch was modified. Review and try the merge again. (HTTP 409)" >&2
    exit 1
  }
  echo '{"sha":"c0ffee0000000000000000000000000000000000","merged":true,"message":"Pull Request successfully merged"}'
  ;;
*markPullRequestReadyForReview*)
  [ -f "$fx/mutation-fail" ] && {
    echo "gh: blocked by proxy (HTTP 403)" >&2
    exit 1
  }
  echo '{"data":{"markPullRequestReadyForReview":{"pullRequest":{"isDraft":false}}}}'
  ;;
*graphql* | "pr "* | "repo view"*)
  echo "gh: blocked by proxy (HTTP 403)" >&2
  exit 1
  ;;
*"/pulls?head="*) jq -r "$f" "$fx/listing.json" ;;
*"/issues/7/comments"*) [ -f "$fx/comments.json" ] && jq -r "$f" "$fx/comments.json" || echo "[]" | jq -r "$f" ;;
*"/pulls/7/reviews"*)
  [ -f "$fx/reviews-fail" ] && {
    echo "gh: (HTTP 403)" >&2
    exit 1
  }
  jq -r "$f" "$fx/reviews.json"
  ;;
*"/pulls/7/files"*) echo '[{"filename":"src/a.ts","status":"added"}]' | jq -r "$f" ;;
*"/check-runs"*) [ -f "$fx/checks.json" ] && cat "$fx/checks.json" || echo '{"total_count":0,"check_runs":[]}' ;;
*"/pulls/7") jq -r "$f" "$fx/pull.json" ;;
*) exit 1 ;;
esac
