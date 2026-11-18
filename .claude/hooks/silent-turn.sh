#!/usr/bin/env bash

# Claude Code sends a payload and closes stdin. A bare read with nothing feeding
# it blocks forever and holds the session open, so the read is bounded. `read`
# rather than `timeout cat`, which macOS does not ship.
IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

event=$(printf '%s' "$input" | jq -r '.hook_event_name // empty')
[ "$event" = "Stop" ] || exit 0

# A forced continuation after a block fires this hook again with
# stop_hook_active true, measured to hold without a session-keyed marker, so
# the field alone stops a second block.
stop_hook_active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false')
[ "$stop_hook_active" = "true" ] && exit 0

# The closing text comes from the payload itself rather than transcript_path.
# A driven spike found the file missing that entry for roughly two seconds
# after Stop fires, while this field already carries the same text with no lag.
last_message=$(printf '%s' "$input" | jq -r '.last_assistant_message // empty')
transcript_path=$(printf '%s' "$input" | jq -r '.transcript_path // empty')
prompt_id=$(printf '%s' "$input" | jq -r '.prompt_id // empty')

[ -n "$transcript_path" ] && [ -f "$transcript_path" ] || exit 0
[ -n "$prompt_id" ] || exit 0

# The scan starts where the turn began, since the transcript holds every prior
# turn. The turn's first entry is the first stamped with its promptId, measured
# exact.
line_start=$(grep -Fn "\"promptId\":\"$prompt_id\"" "$transcript_path" | head -1 | cut -d: -f1)
[ -n "$line_start" ] || exit 0

# The turn's Write and Edit tool calls land in the file before Stop fires, the
# same spike found, so this read needs no retry the way the closing text would.
paths=$(tail -n +"$line_start" "$transcript_path" | jq -r '
  select(.type == "assistant") |
  .message.content[]? |
  select(.type == "tool_use" and (.name == "Write" or .name == "Edit" or .name == "MultiEdit")) |
  .input.file_path
' 2>/dev/null | sort -u)
[ -n "$paths" ] || exit 0

# Two written paths sharing a basename fall back to the full path, so one
# mention never covers both. The count avoids an associative array, since
# macOS ships bash 3.2.
colliding=$(while IFS= read -r path; do
  [ -n "$path" ] || continue
  printf '%s\n' "${path##*/}"
done <<<"$paths" | sort | uniq -d)

unmentioned=()
while IFS= read -r path; do
  [ -n "$path" ] || continue
  base=${path##*/}
  if [ -n "$colliding" ] && printf '%s\n' "$colliding" | grep -Fxq -- "$base"; then
    needle="$path"
  else
    needle="$base"
  fi
  case "$last_message" in
  *"$needle"*) ;;
  *) unmentioned+=("$path") ;;
  esac
done <<<"$paths"
[ ${#unmentioned[@]} -eq 0 ] && exit 0

{
  echo 'This turn wrote or edited a file the final reply did not name:'
  printf -- '- %s\n' "${unmentioned[@]}"
  echo
  echo 'Name every touched path in the reply, then finish. This block fires once regardless of what the reply names.'
} >&2
exit 2
