#!/usr/bin/env bash

# canon-no-seed: unproven. Held local until the task's outcomes confirm the
# denial condition holds beyond this branch. See v97.3's Findings.

IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

tool=$(printf '%s' "$input" | jq -r '.tool_name // empty')
case "$tool" in
Agent | Task) ;;
*) exit 0 ;;
esac

# CLAUDE_CODE_SESSION_ATTENDED read 0 in every background session measured and
# unset in an interactive desktop session (CLAUDE_CODE_ENTRYPOINT=claude-desktop),
# and is documented nowhere. An interactive terminal session has not been
# measured. A session where the variable holds anything but 0, including
# unset or unmeasured, is one this hook cannot classify, and an unclassifiable
# session is let through silently rather than blocked or reported clear, since
# neither verdict is one this reading can back.
[ "${CLAUDE_CODE_SESSION_ATTENDED:-}" = "0" ] || exit 0

printf 'Unattended session (CLAUDE_CODE_SESSION_ATTENDED=0) may not call the Agent tool. A background worker forked an agent to build its plan, then wrote the same files by hand while the fork was still running, and the two collided. Do the work in this session directly instead.\n' >&2
exit 2
