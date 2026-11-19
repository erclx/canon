#!/usr/bin/env bash
# Fake canon for src/claude/orchestrate-poll.test.ts. Answers review-state, lift, and evidence from FAKE_FIXTURES.
fx="$FAKE_FIXTURES"
if [ "$1 $2" = "pr review-state" ]; then
  cat "$fx/scope-$3.json"
  exit 0
fi
if [ "$1 $2" = "pr lift" ] && [ -f "$fx/lift-$3.json" ]; then
  cat "$fx/lift-$3.json"
  exit 1
fi
if [ "$1 $2" = "pr evidence" ] && [ -f "$fx/evidence-$3.json" ]; then
  echo "$3" >>"$fx/evidence-reads.txt"
  cat "$fx/evidence-$3.json"
  exit 0
fi
exit 1
