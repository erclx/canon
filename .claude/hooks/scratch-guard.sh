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

# Both record roots, and the scratch folder loses its leading dot under the new
# one, since inside a dotted root the dot hides nothing already hidden. A guard
# fixed at the old spelling warns on every correct scratch write in a project
# the move has reached.
case "$file_path" in
*/.claude/.tmp/* | */.canon/tmp/*) exit 0 ;;
esac

# A project whose own root sits under a path carrying a tmp segment is not
# writing to system temp, and the bare pattern below would trip on every source
# file it holds. The project root is stripped before the match rather than
# exiting on it, so the segments the patterns look for are the ones the write
# adds. Exiting on any path under the project gives up <project>/tmp/ as well,
# which is a genuine violation this still warns on.
matched=$file_path
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  case "$file_path" in
  "$CLAUDE_PROJECT_DIR"/*) matched=${file_path#"$CLAUDE_PROJECT_DIR"} ;;
  esac
fi

case "$matched" in
*/tmp/* | *\\tmp\\* | */Temp/* | *\\Temp\\* | */var/folders/*) ;;
*) exit 0 ;;
esac

session=$(printf '%s' "$input" | jq -r '.session_id // "none"')
key=$(printf '%s' "$session" | tr -c 'A-Za-z0-9' '_')
project="${CLAUDE_PROJECT_DIR:-.}"
if [ -d "$project/.canon" ]; then
  marker_dir="$project/.canon/tmp/hooks/scratch-guard"
else
  marker_dir="$project/.claude/.tmp/hooks/scratch-guard"
fi
marker="$marker_dir/$key"
[ -f "$marker" ] && exit 0
mkdir -p "$marker_dir"
: >"$marker"

msg='Temporary file write outside the project scratch folder. Write temp files to .canon/tmp/<slug>/ in the project root, or .claude/.tmp/<slug>/ where the project carries no .canon/ root, not system temp. See the Scratch rule (055-scratch, under core/ in your installed governance rules).'
jq -nc --arg msg "$msg" '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$msg}}'
