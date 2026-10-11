#!/usr/bin/env bash

# canon-no-seed: this repository turned the harness's auto memory off through
# autoMemoryEnabled, and this hook is the check behind that switch. A target's
# own memory folder is inert since #2300, and turning off a harness feature in
# someone else's project is that operator's preference rather than a fact canon
# owns. See the guards context entry.

IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

# Bash is the highest-frequency tool, so the one field a write names is lifted
# out of the raw payload and tested with a shell pattern before jq starts. The
# whole payload cannot be tested, since every real one carries transcript_path
# under ~/.claude/projects/ and so matches the pair on its own. A tool that
# carries neither key reads no field and leaves quietly.
field_re='"(command|file_path)":"(([^"\\]|\\.)*)"'
[[ $input =~ $field_re ]] || exit 0
case "${BASH_REMATCH[2]}" in
*projects/*memory*) ;;
*) exit 0 ;;
esac

# A file tool carries an absolute file_path and Bash carries the command
# unexpanded, so each arm reads its own field and every other tool reads none.
target=$(printf '%s' "$input" | jq -r '
  if (.tool_name | IN("Write", "Edit", "MultiEdit")) then .tool_input.file_path
  elif .tool_name == "Bash" then .tool_input.command
  else empty end // empty')
[ -n "$target" ] || exit 0

# The shape is <root>/projects/<one segment>/memory, so a bare memory segment
# elsewhere, such as src/memory or .canon/memory, stays writable. The root is
# .claude under a home directory, spelled ~, $HOME, or absolute, or the
# directory CLAUDE_CONFIG_DIR names.
tail='/projects/[^/[:space:]]+/memory([^A-Za-z0-9._-]|$)'
hit=0
if [[ $target =~ \.claude$tail ]]; then
  hit=1
elif [[ $target =~ CLAUDE_CONFIG_DIR\}?$tail ]]; then
  hit=1
elif [ -n "${CLAUDE_CONFIG_DIR:-}" ] && [[ $target =~ "${CLAUDE_CONFIG_DIR%/}"$tail ]]; then
  hit=1
fi
[ "$hit" = 1 ] || exit 0

printf 'Auto memory is off in this repository, so nothing writes into a harness memory folder. Put a kept fact in the owning task'\''s Findings, or in the context entry that owns it under canon/context/.\n' >&2
exit 2
