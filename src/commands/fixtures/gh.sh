#!/usr/bin/env bash
# Fake gh for src/commands/pr.test.ts. Reads FAKE_GH_FX, FAKE_GH_COMMENTS, and FAKE_GH_API_LOG.
set -o pipefail
fx="$FAKE_GH_FX"
f=.
p=
for a in "$@"; do
  [ "$p" = --jq ] && f=$a
  p=$a
done
case "$*" in
*graphql* | "pr "* | "repo view"*) exit 1 ;;
api*pulls/7/files*)
  echo "$*" >>"$fx/files-calls.log"
  [ -f "$fx/files-fail" ] && exit 1
  {
    if [ -f "$fx/files.tsv" ]; then
      cat "$fx/files.tsv"
    else
      git diff --name-status --no-renames main...HEAD | sed -e 's/^A/added/' -e 's/^M/modified/' -e 's/^D/removed/'
    fi
  } | jq -Rn '[inputs | select(length > 0) | split("\t") | {status: .[0], filename: .[1]}]' | jq -r "$f"
  ;;
api*git/trees/*)
  [ -f "$fx/base-tree.json" ] || exit 1
  jq -r "$f" "$fx/base-tree.json"
  ;;
api*contents/*)
  a="$*"
  p=${a##*contents/}
  p=${p%%\?*}
  r=${a##*ref=}
  [ -f "$fx/img/$r-$(basename "$p")" ] && cat "$fx/img/$r-$(basename "$p")" || exit 1
  ;;
api*compare/*)
  if [ -f "$fx/merge-base" ]; then cat "$fx/merge-base"; else git merge-base main HEAD; fi
  ;;
"api -X PUT repos/{owner}/{repo}/pulls/7/reviews/"*)
  id=${4##*/}
  echo "$id" >>"$fx/review-puts.log"
  [ -f "$fx/review-put-fail-$id" ] && exit 1
  printf '%s\n' "${@: -1}" >>"$fx/review-bodies.log"
  echo "{}"
  ;;
api*pulls/7/reviews*) [ -f "$fx/ui-reviews.json" ] && jq -r "$f" "$fx/ui-reviews.json" ;;
api*issues/7/comments*) jq '[.comments[] | {html_url: .url, body}]' "$FAKE_GH_COMMENTS" | jq -r "$f" ;;
"api -X PATCH repos/{owner}/{repo}/pulls/7 "*)
  [ -f "$fx/body-fail" ] && exit 1
  printf '%s' "${@: -1}" >"$fx/body-write.log"
  echo "{}"
  ;;
"api repos/{owner}/{repo}/pulls/7")
  if [ -f "$fx/head" ]; then h=$(cat "$fx/head"); else h=$(git rev-parse HEAD); fi
  b=
  [ -f "$fx/pr-body" ] && b=$(cat "$fx/pr-body")
  jq -n --arg h "$h" --arg b "$b" '{number:7,head:{ref:"feat/x",sha:$h},base:{ref:"main"},mergeable_state:"clean",body:$b}'
  ;;
"api repos/{owner}/{repo}") echo "{\"full_name\":\"o/r\"}" ;;
api*)
  printf '%s' "${@: -1}" >"$FAKE_GH_API_LOG"
  echo "{}"
  ;;
*) exit 1 ;;
esac
