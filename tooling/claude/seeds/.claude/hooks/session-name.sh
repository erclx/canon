#!/usr/bin/env bash

# Claude Code sends a payload and closes stdin. A bare read with nothing feeding
# it blocks forever and holds the session open, so the read is bounded. `read`
# rather than `timeout cat`, which macOS does not ship.
IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

# A session id reaches a reply as its first 8 hex characters, standing alone
# between characters that are not letters, digits, or a slash, so an id inside a
# path passes. A 40-character hash never matches, and a short one only until the roster read.
token='(^|[^0-9A-Za-z/])[0-9a-f]{8}([^0-9A-Za-z/]|$)'

# A payload holding no such token anywhere leaves before anything spawns. A real
# Stop payload carries its own session id, so the reply is tested again below.
[[ $input =~ $token ]] || exit 0

# A failure to measure exits 1 rather than 2. Exit 2 forces the session to
# continue, and a hook that cannot read `stop_hook_active` would then block
# every continuation too.
unread() {
  printf 'Session-name: the final reply was not checked. %s\n' "$1" >&2
  exit 1
}

command -v jq >/dev/null 2>&1 || unread 'Found no `jq` on PATH.'

event=$(printf '%s' "$input" | jq -r '.hook_event_name // empty' 2>/dev/null)
[ -n "$event" ] || unread 'The payload did not parse.'
[ "$event" = "Stop" ] || exit 0

# The forced continuation after a block fires this hook again with the field
# true. Passing it is what makes the block fire once, so a session that cannot
# comply still ends.
stop_hook_active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false')
[ "$stop_hook_active" = "true" ] && exit 0

reply=$(printf '%s' "$input" | jq -r '.last_assistant_message // empty')
[[ $reply =~ $token ]] || exit 0

# A project has no checkout of the CLI, so this resolves the installed binary
# alone, and a machine without it says so rather than passing the reply.
if command -v canon >/dev/null 2>&1; then
  roster=$(canon sessions list --json 2>/dev/null)
else
  unread 'Found no `canon` binary on PATH. Install one with `bun add -g @erclx/canon`.'
fi
[ -n "$roster" ] || unread 'The roster read returned no record.'

# The record decides rather than the exit code, since a refusal carries no
# `sessions`. A session counts as named when its roster name appears anywhere
# in the reply, so a heading naming it beside its quoted id passes.
flagged=$(printf '%s' "$roster" | jq -r --arg reply "$reply" '
  if (.sessions | type) != "array" then "unread"
  else
    ([$reply | scan("(?<![0-9A-Za-z/])[0-9a-f]{8}(?![0-9A-Za-z/])")] | unique) as $ids
    | ($reply | ascii_downcase) as $text
    | [.sessions[]
        | select((.name // "") != "" and (.sessionId | type) == "string")
        | . as $s
        | select(any($ids[]; . as $id | $s.sessionId | startswith($id)))
        | select(($text | contains($s.name | ascii_downcase)) | not)
        | "- \($s.sessionId[0:8]) is \($s.name)"]
    | unique | .[]
  end
' 2>/dev/null) || unread 'The roster returned no record that parsed.'

case "$flagged" in
'') exit 0 ;;
unread) unread 'The roster read returned no sessions. An installed `canon` that predates `canon sessions list` or a refusal does this.' ;;
esac

{
  printf 'Session-name: the final reply names a live session by its id alone, while the operator finds sessions by name. Rewrite it with the name, and keep the id in brackets beside it where a command takes the id:\n'
  printf '%s\n' "$flagged"
} >&2
exit 2
