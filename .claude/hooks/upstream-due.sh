#!/usr/bin/env bash

# canon-no-seed: reads src/cli.ts and the upstream cursor, which a target does not carry, since the digest is not shipped to targets.

# Tells the operator when an upstream digest is due, as one line at the start
# of an attended session. The line goes through `systemMessage` to the operator
# and never into the model's context, which would spend a transcript line in
# every session and invite the model to start a digest unasked. Every failure
# exits 0 silently, since a broken reminder must not block a session start.

IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

# A background session has no operator to read the line, and about twenty of
# them start together in a dispatch wave.
[ "${CLAUDE_CODE_SESSION_ATTENDED:-}" = "0" ] && exit 0

source=$(printf '%s' "$input" | jq -r '.source // empty' 2>/dev/null) || exit 0
[ "$source" = "startup" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$PWD}"
[ -f "$root/src/cli.ts" ] || exit 0
command -v bun >/dev/null 2>&1 || exit 0

record=$(bun "$root/src/cli.ts" upstream due --json 2>/dev/null) || exit 0
printf '%s' "$record" | jq -e '.due == true' >/dev/null 2>&1 || exit 0

reason=$(printf '%s' "$record" | jq -r '.reason // empty')
releases=$(printf '%s' "$record" | jq -r '.releases // empty')

case "$reason" in
no-cursor) message='No upstream digest has been run yet. Run /internal-upstream-digest.' ;;
*)
  if [ "$releases" = "1" ]; then
    message='1 Claude Code release since the last upstream digest. Run /internal-upstream-digest.'
  elif [ -n "$releases" ]; then
    message="$releases Claude Code releases since the last upstream digest. Run /internal-upstream-digest."
  else
    message='Claude Code is ahead of the last upstream digest. Run /internal-upstream-digest.'
  fi
  ;;
esac

jq -n --arg message "$message" '{systemMessage: $message}'
