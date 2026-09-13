#!/usr/bin/env bash

# canon-no-seed: points a session at this checkout's development context entry, a toolkit-authored entry describing this checkout's own scripts, which does not and should not exist in a target.

# Claude Code sends a payload and closes stdin. A bare read with nothing feeding
# it blocks forever and holds the session open, so the read is bounded. `read`
# rather than `timeout cat`, which macOS does not ship.
IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

# Matching inside jq keeps the whole payload to one process on the hot path, and
# preserves a multi-line command that @tsv would escape past the anchor.
session=$(printf '%s' "$input" | jq -r '
  if .tool_name != "Bash" then "SKIP"
  elif ((.tool_input.command // "") | test("(bun|npm|pnpm|yarn) run (check:install|check|format)([[:space:]]|$)")) then (.session_id // "")
  else "SKIP" end')

[ "$session" = "SKIP" ] && exit 0
[ -n "$session" ] || exit 0

project="${CLAUDE_PROJECT_DIR:-.}"

# The entry sits under whichever surface root the checkout carries, the moved
# root first, so a checkout the surface move has not reached still gets the
# reminder rather than silence.
entry=""
for root in canon .claude; do
  candidate="$root/context/development/index.md"
  if [ -f "$project/$candidate" ]; then
    entry="$candidate"
    break
  fi
done
[ -n "$entry" ] || exit 0

key=$(printf '%s' "$session" | tr -c 'A-Za-z0-9' '_')
# The marker is scratch, so it follows the scratch folder to whichever record
# root the project carries rather than creating a second one beside it.
if [ -d "$project/.canon" ]; then
  marker_dir="$project/.canon/tmp/dev-command-reminder"
else
  marker_dir="$project/.claude/.tmp/dev-command-reminder"
fi
marker="$marker_dir/$key"
[ -f "$marker" ] && exit 0
mkdir -p "$marker_dir"
: >"$marker"

msg=$(printf 'Dev commands have gotchas documented at %s. Read it before interpreting this run, it covers the script and hook reference.' "$entry")
jq -nc --arg msg "$msg" '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$msg}}'
