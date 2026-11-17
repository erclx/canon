#!/usr/bin/env bash
# Fake canon for src/tooling/verify-runner.test.ts. The context audit echoes
# its argv and exits CONTEXT_EXIT, and every other verb passes, so only the
# context audit stage decides the run.
if [ "$1" = context ]; then
  echo "context finding: $*"
  exit "${CONTEXT_EXIT:-0}"
fi
exit 0
