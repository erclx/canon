#!/usr/bin/env bash

# Claude Code sends a payload and closes stdin. A bare read with nothing feeding
# it blocks forever and holds the session open, so the read is bounded. `read`
# rather than `timeout cat`, which macOS does not ship.
IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

# A reply with no link is the ordinary turn, so it leaves before anything
# spawns. The payload holds the reply JSON-escaped, and `](` survives the
# escaping untouched, so a shell test on the raw payload is enough. This is the
# one quiet exit: every later failure to measure reports instead.
case "$input" in
*']('*) ;;
*) exit 0 ;;
esac

# A failure to measure exits 1 rather than 2. Exit 2 forces the session to
# continue, and a hook that cannot read `stop_hook_active` would then block
# every continuation too.
unread() {
  printf 'Reply-links: the final reply was not checked. %s\n' "$1" >&2
  exit 1
}

command -v jq >/dev/null 2>&1 || unread 'Found no `jq` on PATH.'

event=$(printf '%s' "$input" | jq -r '.hook_event_name // empty' 2>/dev/null)
[ -n "$event" ] || unread 'The payload did not parse.'
[ "$event" = "Stop" ] || exit 0

# The forced continuation after a block fires this hook again with the field
# true. Passing it is what makes the block fire once, so the corrected links
# are not checked a second time.
stop_hook_active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false')
[ "$stop_hook_active" = "true" ] && exit 0

reply=$(printf '%s' "$input" | jq -r '.last_assistant_message // empty')
case "$reply" in
*']('*) ;;
*) exit 0 ;;
esac

# The verb resolves a relative link against the main worktree root, read from
# the directory the session stands in, so the payload's cwd is named rather than
# inherited from wherever the hook was spawned.
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
[ -n "$cwd" ] && [ -d "$cwd" ] || unread 'The payload carried no working directory that exists.'

# A project has no checkout of the CLI, so this resolves the installed binary
# alone, and a machine without it says so rather than passing the reply.
if command -v canon >/dev/null 2>&1; then
  record=$(cd "$cwd" && printf '%s' "$reply" | canon hooks reply-links --json 2>/dev/null)
else
  unread 'Found no `canon` binary on PATH. Install one with `bun add -g @erclx/canon`.'
fi

# The record decides rather than the exit code. A binary predating the verb
# exits 1 on an unknown command, which is the code a finding also leaves, and
# it writes no record.
ok=$(printf '%s' "$record" | jq -r 'if .ok == true then "true" elif .ok == false then "false" else empty end' 2>/dev/null)
case "$ok" in
true) exit 0 ;;
false)
  printf '%s\n' "$(printf '%s' "$record" | jq -r '.message')" >&2
  exit 2
  ;;
*) unread 'The link check returned no record. An installed `canon` that predates `canon hooks reply-links` does this.' ;;
esac
