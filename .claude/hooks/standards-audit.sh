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
# Session record folders are skipped, since they hold prose nobody publishes.
*.claude/review/* | *.claude/plans/*) exit 0 ;;
*.canon/tmp/* | *.canon/review/* | *.canon/plans/*) exit 0 ;;
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

# Two advisory measures ride in the same record and never gate. A heading's
# case is read for the whole file, since it is cheap to fix where it stands. A
# colon is kept only where the word before it and the colon appear in the text
# this write carried, since an edit often rewrites part of a line and a
# whole-line match would drop exactly that case. The verb names that word as
# `lead`, since slicing `text` at `column` miscounts after an emoji, and a
# binary predating the field falls back to the slice. A file holds colons nobody is
# asking this edit to answer for.
new=$(printf '%s' "$input" |
  jq -r '[.tool_input.new_string?, .tool_input.content?, (.tool_input.edits[]?.new_string?)] | map(select(. != null)) | join("\n")' 2>/dev/null)
headings=$(printf '%s' "$record" |
  jq -r '.entries[]?.headingCase[]? | ":\(.line)  \(.text)"' 2>/dev/null)
colons=$(printf '%s' "$record" |
  jq -r --arg new "$new" '.entries[]?.colons[]? | (.lead // (.text[:.column] | sub("^.*\\s"; ""))) as $lead | select($new | contains($lead + ":")) | ":\(.line):\(.column + 1)  \(.text)"' 2>/dev/null)

# Density findings are handed back whole, gating or not, since the verb only
# returns them for a path in its scope and a finding the push does not fail on
# yet is the one a rewrite has to clear before its folder is gated.
density=$(printf '%s' "$record" |
  jq -r '.entries[]?.density[]? | ":\(.line)  \(.kind)  " + (if .kind == "table-then-list" then "a list follows the table with no lead sentence" elif .limit == null then "opens with neither a paragraph nor a table" else "\(.value) past \(.limit)" end) + (if .gating then "  gating" else "" end)' 2>/dev/null)

# The row count and the wide token report and never gate, so each kind is handed
# back with the fix its shape takes rather than the seam a density finding
# splits at. The cell and the trailing list arrive as density findings.
tables=$(printf '%s' "$record" |
  jq -r '.entries[]?.tables[]? | ":\(.line)  \(.kind)  " + "\(.value) past \(.limit)"' 2>/dev/null)

# A page marked `kind: reference` carries reference shape findings, handed back
# whole the same way, since a gated one fails the push like a density finding.
shape=$(printf '%s' "$record" |
  jq -r '.entries[]?.referenceShape[]? | ":\(.line)  \(.kind)  \(.text)" + (if .gating then "  gating" else "" end)' 2>/dev/null)

# A set the verb shipped empty measures nothing and would report a clean file.
# Reading the findings alone turned that narrowed check into a pass once, back
# when a standard could go missing, and the sets shipping with the package moves
# the cause rather than removing it.
empty=$(printf '%s' "$record" |
  jq -r '[.bans.emptySets[]?] | join(", ")' 2>/dev/null)

[ -z "$hits" ] && [ -z "$headings" ] && [ -z "$colons" ] && [ -z "$density" ] && [ -z "$tables" ] && [ -z "$shape" ] && [ -z "$unread" ] && [ -z "$empty" ] && exit 0

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
  found=$(printf 'Standards-audit: markdown.md violations in %s. Split the sentence or rewrite it. A colon or a comma standing where the em dash was is the same sentence. A code span is the answer only where the token is genuinely an identifier under discussion.\n%s' "$file" "$hits")
  msg="${msg:+$msg$nl}$found"
fi

if [ -n "$headings" ]; then
  found=$(printf 'Standards-audit: headings in %s are not sentence case. Lowercase every word after the first unless it is a proper noun, and leave a proper noun as it is.\n%s' "$file" "$headings")
  msg="${msg:+$msg$nl}$found"
fi

if [ -n "$colons" ]; then
  found=$(printf 'Standards-audit: this write added a colon in the middle of a sentence in %s. A colon belongs after a label or at the end of a line introducing a list. Split the sentence or rewrite it.\n%s' "$file" "$colons")
  msg="${msg:+$msg$nl}$found"
fi

if [ -n "$density" ]; then
  found=$(printf 'Standards-audit: %s breaks the markdown density limits, being a 350-character paragraph, 2 paragraphs in a row, a 200-character bullet, 5 plain bullets in a row, no H4, and a paragraph or table opening every H3, a 120-character table cell, and no list directly after a table. Split each block at its seam rather than trimming words to pass. A finding marked gating fails the push.\n%s' "$file" "$density")
  msg="${msg:+$msg$nl}$found"
fi

if [ -n "$tables" ]; then
  found=$(printf 'Standards-audit: %s breaks the markdown table limits that report, being 8 body rows and a code span holding a run past 30 characters. These never fail a push. Split a long table into groups each under a lead sentence, and move a wide token out of the table.\n%s' "$file" "$tables")
  msg="${msg:+$msg$nl}$found"
fi

if [ -n "$shape" ]; then
  found=$(printf 'Standards-audit: %s is marked kind: reference and breaks its shape, being an opening, then Output, Refusals, and See also, each at most once and in that order, no H3, and no flag table. Point at the command'"'"'s own --help for flags. A finding marked gating fails the push.\n%s' "$file" "$shape")
  msg="${msg:+$msg$nl}$found"
fi

jq -nc --arg msg "$msg" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
