#!/usr/bin/env bash

# Claude Code sends a payload and closes stdin. A bare read with nothing feeding
# it blocks forever and holds the session open, so the read is bounded. `read`
# rather than `timeout cat`, which macOS does not ship.
IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_response.filePath // empty')

file="${file//\\//}"

case "$file" in
*.md) ;;
*) exit 0 ;;
esac

case "$file" in
*.canon/tmp/* | *.canon/memory/* | *.canon/review/* | *.canon/plans/*) exit 0 ;;
esac

[ -f "$file" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-.}"

unread=""
record=""
if command -v canon >/dev/null 2>&1; then
  record=$(cd "$root" 2>/dev/null && canon markdown audit "$file" --json 2>/dev/null) || true
  [ -n "$record" ] || unread="record"
else
  unread="runner"
fi

hits=$(printf '%s' "$record" |
  jq -r '.entries[]?.bans[]? | ":\(.line):\(.column + 1)  \(.kind)  \(.term)"' 2>/dev/null)

empty=$(printf '%s' "$record" |
  jq -r '[.bans.emptySets[]?] | join(", ")' 2>/dev/null)

[ -z "$hits" ] && [ -z "$unread" ] && [ -z "$empty" ] && exit 0

nl=$'\n'
msg=""

if [ "$unread" = "runner" ]; then
  msg=$(printf 'Standards-audit: nothing checked in %s. Found no `canon` binary on PATH. Install one with `bun add -g @erclx/canon`.' "$file")
elif [ "$unread" = "record" ]; then
  msg=$(printf 'Standards-audit: nothing checked in %s. `canon markdown audit` returned no record, which it does when it declines to measure. It needs a git repository to build its corpus.' "$file")
elif [ -n "$empty" ]; then
  msg=$(printf 'Standards-audit: the shipped ban set is empty for %s, so %s was checked against a narrowed set. Reinstall the toolkit with `bun add -g @erclx/canon`.' "$empty" "$file")
fi

if [ -n "$hits" ]; then
  found=$(printf 'Standards-audit: markdown.md violations in %s. Rewrite the sentence (do not lazy-swap). A code span is the answer only where the token is genuinely an identifier under discussion.\n%s' "$file" "$hits")
  msg="${msg:+$msg$nl}$found"
fi

jq -nc --arg msg "$msg" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
