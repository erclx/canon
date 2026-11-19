#!/usr/bin/env bash

# Reports `canon tasks validate` findings after an edit to the board's ordering
# file, and never blocks, since the verbs do not cover every hand move. A
# `Bash` write fires no `PostToolUse` hook, so a heredoc goes unchecked.

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

# Both record roots, read off the path rather than the session, since a linked
# worktree's session edits the main root's board from outside its own project.
case "$file_path" in
*/.canon/tasks/priority.md) base=.canon ;;
*/.claude/tasks/priority.md) base=.claude ;;
*) exit 0 ;;
esac
root="${file_path%/"$base"/tasks/priority.md}"
[ -n "$root" ] || exit 0

report() {
  jq -nc --arg msg "$1" \
    '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
  exit 0
}

if ! command -v canon >/dev/null 2>&1; then
  report "canon is not on PATH, so the board edit was not validated. Run canon tasks validate by hand."
fi

# Exit 2 carries findings, so the status is read off the record rather than
# the exit code.
record=$(canon tasks validate --json --root "$root" 2>/dev/null)
ok=$(printf '%s' "$record" | jq -r '.ok | tostring' 2>/dev/null)

if [ "$ok" = false ]; then
  report "canon tasks validate refused the board after this edit: $(printf '%s' "$record" | jq -r '.message // .reason')"
fi
[ "$ok" = true ] || report "canon tasks validate wrote no record after this edit, so the board was not validated."

findings=$(printf '%s' "$record" | jq -r '.findings[] | "- \(.kind): \(.subject) \(.message)"' | head -10)
[ -n "$findings" ] || exit 0

report "The board edit left findings. Rewrite the rows through canon tasks place, promote, move, block, or launch, which derive every cell but Waiting on and Launch.
$findings"
