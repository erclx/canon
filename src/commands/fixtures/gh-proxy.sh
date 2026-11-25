#!/usr/bin/env bash
# Fake gh that blocks GraphQL like the proxy, for src/commands/pr/rest.test.ts and src/commands/pr/drive-copy.test.ts, loaded through PROXY_GH in src/commands/pr/fixture.ts. Reads FAKE_DIR.
set -o pipefail
fx="$FAKE_DIR"
echo "$*" >>"$fx/gh.log"
# rate-limited holds the rate_limit body, and rate-limited-on a substring that narrows which calls hit it.
if [ -f "$fx/rate-limited" ] && [ "$*" != "api rate_limit" ]; then
  on=$(cat "$fx/rate-limited-on" 2>/dev/null)
  case "$*" in *"$on"*)
    echo "gh: API rate limit exceeded for user ID 1. (HTTP 403)" >&2
    exit 1
    ;;
  esac
fi
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
*"/rules/branches/"*) [ -f "$fx/rules.json" ] && cat "$fx/rules.json" || exit 1 ;;
*"/status?"*)
  [ -f "$fx/status-fail" ] && exit 1
  [ -f "$fx/status.json" ] && cat "$fx/status.json" || echo '{"total_count":0,"statuses":[]}'
  ;;
*"/actions/runs/"*"/jobs"*) [ -f "$fx/jobs.json" ] && cat "$fx/jobs.json" || exit 1 ;;
*"/actions/runs?"*) [ -f "$fx/runs.json" ] && cat "$fx/runs.json" || exit 1 ;;
*"/pulls/7") jq -r "$f" "$fx/pull.json" ;;
"api rate_limit") [ -f "$fx/rate-limited" ] && cat "$fx/rate-limited" || exit 1 ;;
*"/pulls/404")
  echo '{"message":"Not Found","status":"404"}'
  echo "gh: Not Found (HTTP 404)" >&2
  exit 1
  ;;
"api repos/{owner}/{repo}") echo '{"full_name":"acme/widgets","html_url":"https://github.com/acme/widgets"}' ;;
*) exit 1 ;;
esac
