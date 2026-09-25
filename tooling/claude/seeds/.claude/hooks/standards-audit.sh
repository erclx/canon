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

# Four record folders, at either root. A skip list fixed at the old spelling
# audits a project's own session records the moment the move reaches it, which
# reports findings against prose nobody publishes.
case "$file" in
*.claude/.tmp/* | *.claude/memory/* | *.claude/review/* | *.claude/plans/*) exit 0 ;;
*.canon/tmp/* | *.canon/memory/* | *.canon/review/* | *.canon/plans/*) exit 0 ;;
esac

[ -f "$file" ] || exit 0

# The audit verb owns the ban set, so this hook carries no copy of it. The awk
# this replaces parsed its bans out of the project's own standards and
# hardcoded the rest, so edit time and a later corpus check could disagree with
# nothing in between explaining the difference. A ban added to the verb now
# reaches this hook without an edit here.
#
# The verb resolves its own paths under the cwd, so the project root is named
# rather than inherited. The payload carries an absolute file path, which is
# what lets the runner move without taking the argument out of reach.
root="${CLAUDE_PROJECT_DIR:-.}"

# A machine without the binary reports that nothing ran rather than exiting
# clean. An edit nobody checked and an edit carrying no violation are the same
# silence to a reader, so the enforcement a machine lacks is reported.
#
# A completed run always writes the record, and a refusal writes nothing, so an
# empty one means the verb declined to measure rather than measured and found
# nothing. It refuses outside a git repository, which is a project this hook can
# be installed into, and reading the findings alone reports that as a clean file.
unread=""
record=""
if command -v canon >/dev/null 2>&1; then
  record=$(cd "$root" 2>/dev/null && canon markdown audit "$file" --json 2>/dev/null) || true
  [ -n "$record" ] || unread="record"
else
  unread="runner"
fi

# The record decides rather than the exit code, so a binary predating a ban
# class still reports what it does measure. A refusal and an unparseable payload
# both yield nothing, which is the same silence a clean file produces.
hits=$(printf '%s' "$record" |
  jq -r '.entries[]?.bans[]? | ":\(.line):\(.column + 1)  \(.kind)  \(.term)"' 2>/dev/null)

# A set the verb shipped empty measures nothing and would report a clean file.
# Reading the findings alone turns that narrowed check into a pass, so the field
# is read beside them.
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
