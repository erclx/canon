#!/usr/bin/env bash

# canon-no-seed: a scaffolded target without the plugin would meet a blocked /compact naming canon:session-map, a skill it does not carry. See "The handoff routes on the trigger" in canon/ARCHITECTURE.md.

# Claude Code sends a payload and closes stdin. A bare read with nothing feeding
# it blocks forever and holds the session open, so the read is bounded. `read`
# rather than `timeout cat`, which macOS does not ship.
IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

event=$(printf '%s' "$input" | jq -r '.hook_event_name // empty')
[ "$event" = "PreCompact" ] || exit 0

# Each trigger gets the one channel that reaches a session on it. Blocking is
# manual-only: on `auto` the client suppresses the notification and discards the
# blocking reason, so a block there stops the compaction and tells nobody. Exit-0
# stdout is read on both, merged into the instructions the summarizer is given,
# which is why `auto` writes to stdout and carries on. An absent `trigger` takes
# the manual path, since a payload that names no trigger is the one this hook
# cannot afford to answer with silence.
trigger=$(printf '%s' "$input" | jq -r '.trigger // empty')
if [ "$trigger" = "auto" ]; then
  cat <<'MSG'
Preserve the reasoning, not only the conclusions. For every decision this session reached, keep what was measured or read to reach it, the alternative that was rejected and the ground it was rejected on, and any finding that turned out to be wrong.

Keep an open question open rather than resolving it into whichever answer the session was leaning towards. A conclusion whose reasoning is dropped reads as settled to whoever picks the session up, and it cannot be re-argued from a summary alone.
MSG
  exit 0
fi

session=$(printf '%s' "$input" | jq -r '.session_id // "none"')
key=$(printf '%s' "$session" | tr -c 'A-Za-z0-9' '_')
# The marker is scratch, so it follows the scratch folder to whichever record
# root the project carries rather than creating a second one beside it.
project="${CLAUDE_PROJECT_DIR:-.}"
if [ -d "$project/.canon" ]; then
  marker_dir="$project/.canon/tmp/hooks/precompact-handoff"
else
  marker_dir="$project/.claude/.tmp/hooks/precompact-handoff"
fi
marker="$marker_dir/$key"
[ -f "$marker" ] && exit 0

# The marker is what ends the block, so a marker that cannot be written would
# refuse every compaction this session ever takes rather than only the first.
# Failing open costs one unasked handoff and failing closed strands the session,
# so a scratch directory that refuses the write carries on instead.
mkdir -p "$marker_dir" 2>/dev/null || exit 0
: >"$marker" 2>/dev/null || exit 0

# This event carries no `additionalContext`, and stdout reaches the summarizer
# rather than the session, so blocking is the only channel that puts text in
# front of the session itself. Exit 2 makes the stderr text the blocking reason,
# which is why the message goes there rather than to stdout.
cat >&2 <<'MSG'
Compaction blocked once so the handoff is written first. A compaction keeps conclusions and drops the reasoning that produced them, and this session is the only one still holding that reasoning.

Run the canon:session-map skill, then run /compact again. This block fires once per session, so the next /compact proceeds whether or not a map was written.

Where this session holds no reasoning a reader could not get faster from git, say so and write nothing. A map padded from the tree is worse than no map, because the next session trusts it.
MSG
exit 2
