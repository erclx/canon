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
# Four record folders, at either root. A skip list fixed at the old spelling
# audits this repository's own session records the moment the move reaches it,
# which reports findings against prose nobody publishes.
*.claude/.tmp/* | *.claude/memory/* | *.claude/review/* | *.claude/plans/*) exit 0 ;;
*.canon/tmp/* | *.canon/memory/* | *.canon/review/* | *.canon/plans/*) exit 0 ;;
esac

[ -f "$file" ] || exit 0

# The audit verb owns the ban set, so the hook an author meets at edit time and
# the stage that fails the push read one set. The awk this replaces parsed its
# bans out of a standards file and hardcoded the rest, so this hook and the push
# could disagree with nothing in between explaining the difference.
#
# The verb resolves its own paths under the cwd, so the project root is named
# rather than inherited. The payload carries an absolute file path, which is
# what lets the runner move without taking the argument out of reach.
root="${CLAUDE_PROJECT_DIR:-.}"

# A checkout carrying the CLI source runs that source, so this hook and the
# push stage read one build. A globally installed binary lags a branch by
# whatever has not been released, which puts a ban kind added in
# `src/markdown/bans.ts` into the push and not into the edit.
# `cliRunner` in `src/gate/sequencer.ts` names the same reason for the same
# choice on the push side.
#
# A tree without the source falls back to the binary. A machine with neither
# reports that nothing ran rather than exiting clean, since an edit nobody
# checked and an edit carrying no violation are the same silence to a reader.
#
# A completed run always writes the record, and a refusal writes nothing, so an
# empty one means the verb declined to measure rather than measured and found
# nothing. It refuses outside a git repository, and reading the findings alone
# reports that as a clean file.
unread=""
record=""
if [ -f "$root/src/cli.ts" ] && command -v bun >/dev/null 2>&1; then
  record=$(cd "$root" 2>/dev/null && bun src/cli.ts markdown audit "$file" --json 2>/dev/null) || true
elif command -v canon >/dev/null 2>&1; then
  record=$(cd "$root" 2>/dev/null && canon markdown audit "$file" --json 2>/dev/null) || true
else
  unread="runner"
fi

[ -n "$unread" ] || [ -n "$record" ] || unread="record"

# The record decides rather than the exit code, so a binary predating the gate
# reports its findings here all the same. A refusal and an unparseable payload
# both yield nothing, which is the same silence a clean file produces.
hits=$(printf '%s' "$record" |
  jq -r '.entries[]?.bans[]? | ":\(.line):\(.column + 1)  \(.kind)  \(.term)"' 2>/dev/null)

# A set the verb shipped empty measures nothing and would report a clean file.
# Reading the findings alone turned that narrowed check into a pass once, back
# when a standard could go missing, and the sets shipping with the package moves
# the cause rather than removing it.
empty=$(printf '%s' "$record" |
  jq -r '[.bans.emptySets[]?] | join(", ")' 2>/dev/null)

[ -z "$hits" ] && [ -z "$unread" ] && [ -z "$empty" ] && exit 0

nl=$'\n'
msg=""

if [ "$unread" = "runner" ]; then
  msg=$(printf 'Standards-audit: nothing checked in %s. Resolved neither the checkout CLI at %s/src/cli.ts nor an installed `canon` binary. Install one with `bun add -g @erclx/canon`.' "$file" "$root")
elif [ "$unread" = "record" ]; then
  msg=$(printf 'Standards-audit: nothing checked in %s. The audit returned no record, which it does when it declines to measure. It needs a git repository to build its corpus.' "$file")
elif [ -n "$empty" ]; then
  msg=$(printf 'Standards-audit: the shipped ban set is empty for %s, so %s was checked against a narrowed set. The sets ship with the package, so this is a defect in the build rather than a missing install.' "$empty" "$file")
fi

if [ -n "$hits" ]; then
  found=$(printf 'Standards-audit: markdown.md violations in %s. Rewrite the sentence (do not lazy-swap). A code span is the answer only where the token is genuinely an identifier under discussion.\n%s' "$file" "$hits")
  msg="${msg:+$msg$nl}$found"
fi

jq -nc --arg msg "$msg" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
