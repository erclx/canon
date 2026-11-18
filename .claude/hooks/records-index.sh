#!/usr/bin/env bash

# Regenerates the ignored `tasks` folder's index.md after a file in it
# changes. The whole-repo walk skips the folder, so naming the file to
# `canon indexes regen` makes this hook its only trigger.

# Claude Code sends a payload and closes stdin. A bare read with nothing feeding
# it blocks forever and holds the session open, so the read is bounded. `read`
# rather than `timeout cat`, which macOS does not ship.
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

# Both record roots. A `case` `*` crosses `/`, so an unrendered subfolder
# exits first, and the root comes from the path, since the board sits at the
# main root outside a linked worktree's project.
case "$file_path" in
*/.canon/tasks/index.md | */.canon/tasks/archive/* | */.canon/tasks/declined/*) exit 0 ;;
*/.claude/tasks/index.md | */.claude/tasks/archive/* | */.claude/tasks/declined/*) exit 0 ;;
*/.canon/tasks/*.md)
  folder=tasks
  base=.canon
  ;;
*/.claude/tasks/*.md)
  folder=tasks
  base=.claude
  ;;
*) exit 0 ;;
esac
root="${file_path%/"$base/$folder"/*}"
index="$base/$folder/index.md"
[ -n "$root" ] || exit 0

# Report a missing CLI rather than exiting quietly. The path guard above already
# scopes this to a record-file edit, so the message only fires where the stale
# index it warns about is the actual outcome.
if ! command -v canon >/dev/null 2>&1; then
  msg="canon is not on PATH, so $index was not regenerated and is now stale. Install the toolkit CLI or run canon indexes regen by hand."
  jq -nc --arg msg "$msg" \
    '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
  exit 0
fi

# `--no-stage` because a hook has no business touching the index. On a project
# whose folder is not gitignored, the default auto-stage would silently add
# record files to whatever commit is being assembled.
output=$(canon indexes regen --no-stage --root "$root" "$file_path" 2>&1) && exit 0

# A failure here means a file lacks `title` or `description`, and no gate
# stage reaches this ignored folder, so report it or the drift stays.
errors=$(printf '%s\n' "$output" | grep '^ERROR: ' | head -5)
[ -n "$errors" ] || errors="$output"

msg="The $folder index regen failed, so $index is now stale. Fix the frontmatter and save again. $errors"
jq -nc --arg msg "$msg" \
  '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
exit 0
