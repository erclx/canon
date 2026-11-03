#!/usr/bin/env bash
# Fake gh for the pr frames tests in src/commands/pr.test.ts. Refuses every write the way a read-only token does, and logs each call to FAKE_LOG.
echo "$*" >>"$FAKE_LOG"
case "$*" in
"api repos/{owner}/{repo}") echo '{"full_name":"o/r"}' ;;
"api -X GET "*)
  echo "gh: Not Found (HTTP 404)" >&2
  exit 1
  ;;
"api -X "*)
  echo "gh: Resource not accessible by integration (HTTP 403)" >&2
  exit 1
  ;;
*) exit 1 ;;
esac
