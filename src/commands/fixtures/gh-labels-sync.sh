#!/bin/sh
# Fake gh for the labels sync tests in src/commands/labels.test.ts. Reads FAKE_LOG, FAKE_CREATE_FAIL, FAKE_READ_FAIL, and FAKE_REMOTE.
echo "$*" >>"$FAKE_LOG"
case "$*" in
*"-X POST"*)
  [ -n "$FAKE_CREATE_FAIL" ] && exit 1
  exit 0
  ;;
*"repos/{owner}/{repo}/labels"*)
  [ -n "$FAKE_READ_FAIL" ] && exit 1
  printf '%s' "$FAKE_REMOTE"
  ;;
*) exit 1 ;;
esac
