#!/bin/sh
# Fake gh for the labels apply tests in src/commands/labels.test.ts. Reads FAKE_LOG, FAKE_FILES, FAKE_FILES_FAIL, FAKE_TARGET, FAKE_PRESENT, and FAKE_REMOTE.
echo "$*" >>"$FAKE_LOG"
case "$*" in
*"-X POST"*) exit 0 ;;
*pulls/7/files*)
  [ -n "$FAKE_FILES_FAIL" ] && exit 1
  printf '%s' "$FAKE_FILES"
  ;;
*pulls/7*) printf '%s\n' "$FAKE_TARGET" ;;
*issues/7/labels*) printf '%s' "$FAKE_PRESENT" ;;
*"repos/{owner}/{repo}/labels"*) printf '%s' "$FAKE_REMOTE" ;;
*) exit 1 ;;
esac
