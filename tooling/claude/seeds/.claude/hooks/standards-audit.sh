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

# Session record folders are skipped, since they hold prose nobody publishes.
case "$file" in
*.claude/review/* | *.claude/plans/*) exit 0 ;;
*.canon/tmp/* | *.canon/review/* | *.canon/plans/*) exit 0 ;;
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
  jq -r '.entries[]?.density[]? | ":\(.line)  \(.kind)  " + (if .limit == null then "opens with neither a paragraph nor a table" else "\(.value) past \(.limit)" end) + (if .gating then "  gating" else "" end)' 2>/dev/null)

# A page marked `kind: reference` carries reference shape findings, handed back
# whole the same way, since a gated one fails the push like a density finding.
shape=$(printf '%s' "$record" |
  jq -r '.entries[]?.referenceShape[]? | ":\(.line)  \(.kind)  \(.text)" + (if .gating then "  gating" else "" end)' 2>/dev/null)

# A set the verb shipped empty measures nothing and would report a clean file.
# Reading the findings alone turns that narrowed check into a pass, so the field
# is read beside them.
empty=$(printf '%s' "$record" |
  jq -r '[.bans.emptySets[]?] | join(", ")' 2>/dev/null)

[ -z "$hits" ] && [ -z "$headings" ] && [ -z "$colons" ] && [ -z "$density" ] && [ -z "$shape" ] && [ -z "$unread" ] && [ -z "$empty" ] && exit 0

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
  found=$(printf 'Standards-audit: %s breaks the markdown density limits, being a 350-character paragraph, 2 paragraphs in a row, a 200-character bullet, 5 plain bullets in a row, no H4, and a paragraph or table opening every H3. Split each block at its seam rather than trimming words to pass. A finding marked gating fails the push.\n%s' "$file" "$density")
  msg="${msg:+$msg$nl}$found"
fi

if [ -n "$shape" ]; then
  found=$(printf 'Standards-audit: %s is marked kind: reference and breaks its shape, being an opening, then Output, Refusals, and See also, each at most once and in that order, no H3, and no flag table. Point at the command'"'"'s own --help for flags. A finding marked gating fails the push.\n%s' "$file" "$shape")
  msg="${msg:+$msg$nl}$found"
fi

jq -nc --arg msg "$msg" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
