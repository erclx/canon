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
# The first character says which arm answered, since only a command is cut.
target=$(printf '%s' "$input" | jq -r '
  if (.tool_name | IN("Write", "Edit", "MultiEdit")) then "F" + .tool_input.file_path
  elif .tool_name == "Bash" then "B" + .tool_input.command
  else empty end // empty')
[ -n "$target" ] || exit 0
kind=${target:0:1}
target=${target:1}

# A command that only mentions the folder is not a write to it: a heredoc whose
# body quotes the shape, a comment, or prose inside quotes. The command is cut
# with a small awk pass that drops heredoc bodies, comments, and quoted spans
# holding whitespace, and the shape is matched on what is left. A write target
# is a path and carries no whitespace, so no verb list is needed, and a bare or
# whitespace-free quoted token naming the folder still denies. A span or a
# heredoc body handed to an interpreter is code rather than a target, so it
# is kept when the command word is a shell, python, node, perl, ruby, or eval.
# This is a
# scanner and not a shell parser, so a substitution inside double quotes is
# read as quoted text. The cut is copied from review-post-scan.sh, which is
# seeded and so cannot be sourced from this unseeded hook.
if [ "$kind" = B ]; then
  IFS= read -r -d '' cutter <<'AWK'
{ s = s (NR > 1 ? "\n" : "") $0 }
function keep(quote, text, isCode) {
  if (!isCode && text ~ /[ \t\n]/) return " "
  return quote text quote
}
function runsCode(word) {
  sub(/.*\//, "", word)
  return word ~ /^(sh|bash|zsh|dash|eval|python[0-9.]*|node|perl|ruby)$/
}
END {
  n = length(s); q = ""; quoted = ""; out = ""; nt = 0; i = 1; leading = 1; cw = ""
  while (i <= n) {
    c = substr(s, i, 1)
    if (q == "'") {
      if (c == "'") { out = out keep(q, quoted, spanIsCode); q = ""; quoted = "" } else quoted = quoted c
      i++; continue
    }
    if (q == "\"") {
      if (c == "\\") { quoted = quoted c substr(s, i + 1, 1); i += 2; continue }
      if (c == "\"") { out = out keep(q, quoted, spanIsCode); q = ""; quoted = ""; i++; continue }
      quoted = quoted c; i++; continue
    }
    if (c ~ /[;|&(`\n]/) { leading = 1; cw = "" }
    else if (leading) {
      if (c ~ /[ \t]/) { if (cw != "") leading = 0 }
      else if (c == "'" || c == "\"") leading = 0
      else cw = cw c
    }
    if (c == "\\") { out = out c substr(s, i + 1, 1); i += 2; continue }
    if (c == "'" || c == "\"") { q = c; quoted = ""; spanIsCode = !leading && runsCode(cw); i++; continue }
    if (c == "#" && (out == "" || substr(out, length(out), 1) ~ /[ \t\n]/)) {
      while (i <= n && substr(s, i, 1) != "\n") i++
      continue
    }
    if (c == "<" && substr(s, i, 3) == "<<<") { out = out "<<<"; i += 3; continue }
    if (c == "<" && substr(s, i, 2) == "<<") {
      j = i + 2; dash = 0
      if (substr(s, j, 1) == "-") { dash = 1; j++ }
      while (substr(s, j, 1) ~ /[ \t]/) j++
      oq = substr(s, j, 1)
      if (oq == "'" || oq == "\"") j++
      tag = ""
      while (substr(s, j, 1) ~ /[A-Za-z0-9_]/) { tag = tag substr(s, j, 1); j++ }
      if (oq == "'" || oq == "\"") j++
      if (tag != "") {
        nt++; tags[nt] = tag; dashes[nt] = dash; codes[nt] = !leading && runsCode(cw)
        i = j; continue
      }
    }
    if (c == "\n") {
      out = out c; i++
      for (t = 1; t <= nt; t++) {
        while (i <= n) {
          e = index(substr(s, i), "\n")
          if (e == 0) { line = substr(s, i); i = n + 1 } else { line = substr(s, i, e - 1); i += e }
          body = line
          if (dashes[t]) sub(/^\t+/, "", body)
          if (body == tags[t]) break
          if (codes[t]) out = out line "\n"
        }
      }
      nt = 0; continue
    }
    out = out c; i++
  }
  if (q != "") out = out keep(q, quoted)
  print out
}
AWK
  target=$(printf '%s' "$target" | awk "$cutter")
fi
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
