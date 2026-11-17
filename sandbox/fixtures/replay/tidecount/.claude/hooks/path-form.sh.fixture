#!/usr/bin/env bash

# Hands back the absolute path form for a write made from a linked worktree.
#
# A relative path emitted from a linked worktree resolves against that
# worktree rather than the editor root, so the terminal's path detection and
# the desktop app's link both fail silently: nothing happens on the click
# and no error appears. This computes the fact a session was asking itself
# to infer on every response and hands the answer back instead.

IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

tool=$(printf '%s' "$input" | jq -r '.tool_name // empty')
case "$tool" in
Write | Edit | MultiEdit) ;;
*) exit 0 ;;
esac

file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -n "$file_path" ] || exit 0

case "$file_path" in
*/.claude/worktrees/*) ;;
*) exit 0 ;;
esac

abs_path=$(realpath -- "$file_path" 2>/dev/null)
if [ -z "$abs_path" ]; then
  jq -nc --arg msg "path-form.sh could not resolve an absolute form for $file_path from this linked worktree. Report the path per the worktree branch in the output rule instead of guessing." \
    '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
  exit 0
fi

jq -nc --arg path "$abs_path" \
  '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:("This write is from a linked worktree. When reporting this path in your response, use its absolute form: " + $path)}}'
exit 0
