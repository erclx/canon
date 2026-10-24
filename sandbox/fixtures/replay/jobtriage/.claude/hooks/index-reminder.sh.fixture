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
Grep | Glob) ;;
*) exit 0 ;;
esac

path=$(printf '%s' "$input" | jq -r '.tool_input.path // empty')
[ -n "$path" ] || exit 0

if [ -f "$path" ]; then
  dir=$(dirname "$path")
else
  dir="$path"
fi

index=""
cur="$dir"
while :; do
  if [ -f "$cur/index.md" ]; then
    index="$cur/index.md"
    break
  fi
  parent=$(dirname "$cur")
  [ "$parent" = "$cur" ] && break
  cur="$parent"
done

[ -n "$index" ] || exit 0

session=$(printf '%s' "$input" | jq -r '.session_id // "none"')
key=$(printf '%s__%s' "$session" "$index" | tr -c 'A-Za-z0-9' '_')
marker_dir="${CLAUDE_PROJECT_DIR:-.}/.claude/.tmp/index-reminder"
marker="$marker_dir/$key"
[ -f "$marker" ] && exit 0
mkdir -p "$marker_dir"
: >"$marker"

msg=$(printf 'An index.md exists at %s. Read it before searching this folder, it catalogs the sibling files faster than a blind search.' "$index")
jq -nc --arg msg "$msg" '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$msg}}'
