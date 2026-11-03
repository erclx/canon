#!/bin/sh
# Fake binary for src/hooks/post-merge-hook.test.ts. Answers --help from the
# file beside it named <self>.usage, and logs every other call to <self>.log.
for arg in "$@"; do
  if [ "$arg" = "--help" ]; then
    cat "$0.usage"
    exit 0
  fi
done
echo "$*" >>"$0.log"
