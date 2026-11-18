#!/usr/bin/env bash

# Hands back the absolute path for a write from a linked worktree, since a
# relative one resolves against no editor root. The worktree comes from the
# path, since `git rev-parse` answers for the hook process's own directory.

# Claude Code sends a payload and closes stdin. A bare read with nothing
# feeding it blocks forever and holds the session open, so the read is
# bounded. `read` rather than `timeout cat`, which macOS does not ship.
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

# A path with no worktree segment is either the main worktree, where a
# relative path already resolves against the editor root, or a path this
# hook cannot place. Either way there is nothing to hand back.
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
