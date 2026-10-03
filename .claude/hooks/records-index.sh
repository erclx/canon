#!/usr/bin/env bash

# Regenerates the index.md of a gitignored record folder, `tasks` or `memory`,
# after a file in it changes.
#
# These folders are gitignored, so the whole-repo walk in `bun run check` drops
# them and never regenerates their index. Naming the file as a positional
# argument to `canon indexes regen` below bypasses that filter, which makes this
# hook the only trigger that reaches either folder.

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

# Both record roots, since a project the move has reached keeps its records under
# `.canon/` and a guard fixed at the old spelling stops matching with nothing
# said. The index then goes stale while every save reports success.
#
# A shell `case` `*` crosses `/`, so each arm also matches a file in a subfolder
# the index does not render: an archived or declined task, a memory receipt, a
# retired memory entry, or the index itself. Those exit here, before the regen
# call. The exclusions are per folder, since a task under `review/` is indexed
# and a memory `declined/` is not special. The arms are ordered tasks first,
# and no path carries both segments today.
#
# The walk-up boundary has to come from the path, not from the session. Shared
# scratch resolves at the main worktree root, so a session inside a linked
# worktree passes a path that sits outside its own project directory and the
# default boundary would reject it. The messages below name the index read out
# of the same match, so they name the file that actually went stale.
case "$file_path" in
*/.canon/tasks/index.md | */.canon/tasks/archive/* | */.canon/tasks/declined/*) exit 0 ;;
*/.claude/tasks/index.md | */.claude/tasks/archive/* | */.claude/tasks/declined/*) exit 0 ;;
*/.canon/memory/index.md | */.canon/memory/review/* | */.canon/memory/archive/*) exit 0 ;;
*/.claude/memory/index.md | */.claude/memory/review/* | */.claude/memory/archive/*) exit 0 ;;
*/.canon/tasks/*.md)
  folder=tasks
  base=.canon
  ;;
*/.claude/tasks/*.md)
  folder=tasks
  base=.claude
  ;;
*/.canon/memory/*.md)
  folder=memory
  base=.canon
  ;;
*/.claude/memory/*.md)
  folder=memory
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

# Regen failed, which on these folders means a file is missing `title` or
# `description`. Report it. Nothing else can: the folder is gitignored, so the
# whole-repo walk never reaches it and no gate stage will ever fail on a stale
# index. Staying quiet here is what makes the drift permanent.
errors=$(printf '%s\n' "$output" | grep '^ERROR: ' | head -5)
[ -n "$errors" ] || errors="$output"

msg="The $folder index regen failed, so $index is now stale. Fix the frontmatter and save again. $errors"
jq -nc --arg msg "$msg" \
  '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
exit 0
