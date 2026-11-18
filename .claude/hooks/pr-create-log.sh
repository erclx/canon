#!/usr/bin/env bash

# Reminds a worker of the pull-request announcement it owes and logs the
# creation as the miss rate's denominator. It cannot see the send, so it
# states the obligation and claims nothing about it.

# Claude Code sends a payload and closes stdin. A bare read with nothing
# feeding it blocks forever and holds the session open, so the read is
# bounded. `read` rather than `timeout cat`, which macOS does not ship.
IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

# Two shapes open a pull request. `gh pr create` names itself in the command.
# git-pr opens one over REST and prints `opened=true` only on that path, since
# its edit path prints a URL as well and is not an opening.
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
stdout=$(printf '%s' "$input" | jq -r '.tool_response.stdout // empty')
is_hand_opened=false
case "$command" in
*"gh pr create"*) is_hand_opened=true ;;
*)
  printf '%s\n' "$stdout" | grep -qx 'opened=true' || exit 0
  ;;
esac

# Either shape prints the new pull request's URL to stdout on success, so
# matching it is what tells a creation apart from a failed or refused call.
url=$(printf '%s' "$stdout" | grep -Eo 'https://github\.com/[^[:space:]]+/pull/[0-9]+' | tail -1)
[ -n "$url" ] || exit 0

# The log spans a wave, so it lands at the main root rather than in a linked
# worktree that dies with its build, stripped off the path suffix.
root="${CLAUDE_PROJECT_DIR:-.}"
case "$root" in
*/.claude/worktrees/*) root="${root%/.claude/worktrees/*}" ;;
esac
# The log is scratch, so it lives under `.canon/tmp/`.
log_dir="$root/.canon/tmp/pr/log"
mkdir -p "$log_dir"
session=$(printf '%s' "$input" | jq -r '.session_id // "unknown"')
printf -- '- %s session=%s pr=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$session" "$url" >>"$log_dir/log.md"

msg="Pull request $url just opened. If this session holds a worker's channel obligation, announce it to the controller now, per role-worker."
# A pull request opened by hand skipped git-pr, so nothing has labelled it.
# The verb is named only where the installed canon carries it, since a skill
# can reach a target ahead of the release that ships the verb.
if [ "$is_hand_opened" = true ] && canon labels apply --help >/dev/null 2>&1; then
  msg="$msg Run canon labels apply ${url##*/} to label it."
fi

jq -nc --arg msg "$msg" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
