#!/usr/bin/env bash

# canon-no-seed: runs this checkout's src/cli.ts, which no target ships, so seeding this alone ships a permanent no-op. It already no-ops safely where src/cli.ts is absent.

# Claude Code's worktree entry writes core.bare into the shared config and its
# exit never restores it, so every later git command fails. `canon gate run`
# runs the same repair, but a session that only reads git never runs the suite,
# so the tool call is the trigger that fires while the session is still working.

# Draining stdin with the builtin keeps the flag read the only process on the
# path that every invocation but a handful takes.
IFS= read -r -d '' input

root="${CLAUDE_PROJECT_DIR:-.}"
[ "$(git -C "$root" config --get core.bare 2>/dev/null || echo false)" = true ] || exit 0

case "$(printf '%s' "$input" | jq -r '.tool_name // empty')" in
Bash) ;;
*) exit 0 ;;
esac

cli="$root/src/cli.ts"
if [ ! -f "$cli" ]; then
  jq -nc '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:"core.bare is set and the repair did not run, since src/cli.ts is absent. Recovery is '\''git config core.bare false'\''."}}'
  exit 0
fi

# stdout carries the hook protocol, so the verb's record is parsed rather than
# printed. A run that fails leaves the flag set, and the hook says so because the
# flag is already known to be on and nothing else would report it.
if ! record=$(bun "$cli" worktrees repair-bare-flag --root "$root" --json 2>/dev/null); then
  jq -nc '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:"core.bare is set and the repair did not run, since bun is absent or failed on src/cli.ts. Recovery is '\''git config core.bare false'\''."}}'
  exit 0
fi

message=$(printf '%s' "$record" | jq -r '.message // empty')
[ -n "$message" ] || exit 0
jq -nc --arg msg "$message" '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$msg}}'
