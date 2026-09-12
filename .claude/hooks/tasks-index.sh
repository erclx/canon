#!/usr/bin/env bash

# Regenerates .claude/tasks/index.md after a task file changes.
#
# The task folder is gitignored, so the whole-repo walk in `bun run check`
# drops it and never regenerates this index. Naming the file as a positional
# argument to `canon indexes regen` below bypasses that filter, which makes this
# hook the only trigger that reaches the folder.

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

# Both record roots, since a project the move has reached keeps its board under
# `.canon/` and a guard fixed at the old spelling stops matching with nothing
# said. The index then goes stale while every save reports success.
case "$file_path" in
*/.claude/tasks/*.md | */.canon/tasks/*.md) ;;
*) exit 0 ;;
esac

# The board index covers the live folder alone. A shell pattern's wildcard
# crosses a separator, so the guard above matches an archived or declined task
# as well, and a regen fired on one would rebuild the index that task was
# taken out of.
case "$file_path" in
*/.claude/tasks/index.md | */.claude/tasks/archive/* | */.claude/tasks/declined/*) exit 0 ;;
*/.canon/tasks/index.md | */.canon/tasks/archive/* | */.canon/tasks/declined/*) exit 0 ;;
esac

# The walk-up boundary has to come from the path, not from the session. Shared
# scratch resolves at the main worktree root, so a session inside a linked
# worktree passes a path that sits outside its own project directory and the
# default boundary would reject it.
#
# The index this would have rebuilt is read out of the same branch, so both
# messages below name the file that actually went stale rather than one root's
# spelling of it.
case "$file_path" in
*/.canon/tasks/*)
  root="${file_path%/.canon/tasks/*}"
  index=".canon/tasks/index.md"
  ;;
*)
  root="${file_path%/.claude/tasks/*}"
  index=".claude/tasks/index.md"
  ;;
esac
[ -n "$root" ] || exit 0

# Report a missing CLI rather than exiting quietly. The path guard above already
# scopes this to a task-file edit, so the message only fires where the stale
# index it warns about is the actual outcome.
if ! command -v canon >/dev/null 2>&1; then
  msg="canon is not on PATH, so $index was not regenerated and is now stale. Install the toolkit CLI or run canon indexes regen by hand."
  jq -nc --arg msg "$msg" \
    '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
  exit 0
fi

# `--no-stage` because a hook has no business touching the index. On a project
# whose board is not gitignored, the default auto-stage would silently add task
# files to whatever commit is being assembled.
output=$(canon indexes regen --no-stage --root "$root" "$file_path" 2>&1) && exit 0

# Regen failed, which on this folder means a task file is missing `title` or
# `description`. Report it. Nothing else can: the folder is gitignored, so the
# whole-repo walk never reaches it and no gate stage will ever fail on a stale
# index. Staying quiet here is what makes the drift permanent.
errors=$(printf '%s\n' "$output" | grep '^ERROR: ' | head -5)
[ -n "$errors" ] || errors="$output"

msg="Task index regen failed, so $index is now stale. Fix the frontmatter and save again. $errors"
jq -nc --arg msg "$msg" \
  '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
exit 0
