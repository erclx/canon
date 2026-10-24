#!/usr/bin/env bash

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
Write | Edit) ;;
*) exit 0 ;;
esac

file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -n "$file_path" ] || exit 0

case "$file_path" in
*/.claude/.tmp/*) exit 0 ;;
esac

# A project whose own root sits under a path carrying a tmp segment is not
# writing to system temp, and the bare pattern below trips the guard on every
# source file it holds. Anchor on the project root before the pattern match.
#
# This gives up one case on purpose: a write to <project>/tmp/ is a genuine
# scratch violation that no longer warns. The false positive fires on every
# source write in an affected project, so the trade favors the anchor.
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  case "$file_path" in
  "$CLAUDE_PROJECT_DIR"/*) exit 0 ;;
  esac
fi

case "$file_path" in
*/tmp/* | *\\tmp\\* | */Temp/* | *\\Temp\\* | */var/folders/*) ;;
*) exit 0 ;;
esac

session=$(printf '%s' "$input" | jq -r '.session_id // "none"')
key=$(printf '%s' "$session" | tr -c 'A-Za-z0-9' '_')
marker_dir="${CLAUDE_PROJECT_DIR:-.}/.claude/.tmp/scratch-guard"
marker="$marker_dir/$key"
[ -f "$marker" ] && exit 0
mkdir -p "$marker_dir"
: >"$marker"

msg='Temporary file write outside .claude/.tmp/. Write temp files to .claude/.tmp/<slug>/ in the project root, not system temp. See the Scratch rule in CLAUDE.md.'
jq -nc --arg msg "$msg" '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$msg}}'
