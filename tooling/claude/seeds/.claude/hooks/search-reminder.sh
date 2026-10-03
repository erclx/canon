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
[ "$tool" = "WebSearch" ] || exit 0

# Without a session id there is no stable key to dedupe on, and a shared marker
# would silence every later session, so stay quiet rather than guess one.
session=$(printf '%s' "$input" | jq -r '.session_id // empty')
[ -n "$session" ] || exit 0

key=$(printf '%s' "$session" | tr -c 'A-Za-z0-9' '_')
# The marker is scratch, so it follows the scratch folder to whichever record
# root the project carries rather than creating a second one beside it.
project="${CLAUDE_PROJECT_DIR:-.}"
if [ -d "$project/.canon" ]; then
  marker_dir="$project/.canon/tmp/hooks/search-reminder"
else
  marker_dir="$project/.claude/.tmp/hooks/search-reminder"
fi
marker="$marker_dir/$key"
[ -f "$marker" ] && exit 0
mkdir -p "$marker_dir"
: >"$marker"

msg='Load the canon:search-craft skill before this web search. Report it rather than proceeding silently when the skill does not resolve.'
jq -nc --arg msg "$msg" '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$msg}}'
