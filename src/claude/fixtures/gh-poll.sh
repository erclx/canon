#!/usr/bin/env bash
# Fake gh for src/claude/orchestrate-poll.test.ts. Answers the REST reads from FAKE_FIXTURES.
fx="$FAKE_FIXTURES"
if [ "$1" != "api" ]; then exit 1; fi
pulls='repos/{owner}/{repo}/pulls/'
issues='repos/{owner}/{repo}/issues/'
for arg in "$@"; do
  case "$arg" in
  graphql) exit 1 ;;
  "repos/{owner}/{repo}/pulls?state=open"*)
    echo read >>"$fx/list-reads"
    if [ -f "$fx/list-unreadable" ]; then exit 1; fi
    if [ -f "$fx/open.txt" ]; then cat "$fx/open.txt"; else echo 7; fi
    exit 0
    ;;
  "$pulls"*/reviews*)
    n=${arg#"$pulls"}
    n=${n%%/*}
    if [ -f "$fx/unreadable" ]; then exit 1; fi
    cat "$fx/reviews-$n.jsonl"
    exit 0
    ;;
  "$issues"*/comments*)
    n=${arg#"$issues"}
    n=${n%%/*}
    if [ -f "$fx/unreadable" ] || [ -f "$fx/comments-unreadable" ]; then exit 1; fi
    cat "$fx/comments-$n.jsonl"
    exit 0
    ;;
  "$pulls"*)
    n=${arg#"$pulls"}
    cat "$fx/head-$n.txt"
    exit 0
    ;;
  "repos/{owner}/{repo}")
    echo main
    exit 0
    ;;
  esac
done
exit 1
