#!/usr/bin/env bash

# canon-no-seed: the guard reads Claude Code's transcript format, so a change
# to it could block every plan in every synced project. It runs here until it
# has blocked no valid plan, and seeding it is a later row.

# A path-scoped rule loads on a Read, Write, or Edit of a matching file, and a
# heredoc onto `.canon/plans/` is none of them, so the plan rule never reaches
# the session writing most plans. This guard is the check behind that rule: a
# new plan passes only when the transcript shows a `canon:plan-feature`
# invocation this session has not already spent on an earlier new plan, or an
# `auto-ship` invocation naming that plan's path. It
# backs the rule up rather than replacing it, since a hook fails open on a
# timeout and on anything below it cannot read.
IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

# Bash is the highest-frequency tool, so the one field a write names is lifted
# out of the raw payload and tested with a shell pattern before jq starts.
field_re='"(command|file_path)":"(([^"\\]|\\.)*)"'
[[ $input =~ $field_re ]] || exit 0
case "${BASH_REMATCH[2]}" in
*.canon/plans/*) ;;
*) exit 0 ;;
esac

target=$(printf '%s' "$input" | jq -r '
  if .tool_name == "Write" then "F" + .tool_input.file_path
  elif .tool_name == "Bash" then "B" + .tool_input.command
  else empty end // empty')
[ -n "$target" ] || exit 0
kind=${target:0:1}
target=${target:1}

# A command that only mentions the folder is not a write to it, as with
# `canon tasks plan-link` or a heredoc body quoting a plan path. The awk pass
# reads the command as words, drops heredoc bodies, and prints only the words a
# write lands on: the word after a `>` or `>>`, and every argument of `tee` or
# `cp`, whose source is an existing file and so never reads as a new plan. A
# quoted span is one word, so a redirect inside quotes is text. This is a
# scanner and not a shell parser, so a path built in a variable or written by
# `printf` into an interpreter passes unseen.
if [ "$kind" = B ]; then
  IFS= read -r -d '' scanner <<'AWK'
{ s = s (NR > 1 ? "\n" : "") $0 }
function flush() {
  if (!inword) return
  if (redirect) print word
  else if (tag) { nt++; tags[nt] = word; dashes[nt] = dash }
  else if (cmd == "") {
    w = word; sub(/.*\//, "", w)
    if (w !~ /^[A-Za-z_][A-Za-z0-9_]*=/ && w !~ /^(sudo|env|command|exec|time|nice|xargs)$/) cmd = w
  }
  else if ((cmd == "tee" || cmd == "cp") && word !~ /^-/) print word
  word = ""; inword = 0; redirect = 0; tag = 0
}
END {
  n = length(s); i = 1; q = ""; cmd = ""; nt = 0
  while (i <= n) {
    c = substr(s, i, 1)
    if (q != "") {
      if (c == q) q = ""
      else if (q == "\"" && c == "\\") { word = word substr(s, i + 1, 1); i += 2; continue }
      else word = word c
      i++; continue
    }
    if (c == "'" || c == "\"") { q = c; inword = 1; i++; continue }
    if (c == "\\") { word = word substr(s, i + 1, 1); inword = 1; i += 2; continue }
    if (c == " " || c == "\t") { flush(); i++; continue }
    if (c == ">") {
      flush(); i++
      if (substr(s, i, 1) == ">" || substr(s, i, 1) == "|") i++
      if (substr(s, i, 1) == "&") { i++; continue }
      redirect = 1; continue
    }
    if (c == "<" && substr(s, i, 2) == "<<" && substr(s, i, 3) != "<<<") {
      flush(); i += 2; dash = 0
      if (substr(s, i, 1) == "-") { dash = 1; i++ }
      tag = 1; continue
    }
    if (c ~ /[;|&()<`]/) { flush(); if (c != "<") cmd = ""; i++; continue }
    if (c == "\n") {
      flush(); cmd = ""; i++
      for (t = 1; t <= nt; t++) {
        while (i <= n) {
          e = index(substr(s, i), "\n")
          if (e == 0) { line = substr(s, i); i = n + 1 } else { line = substr(s, i, e - 1); i += e }
          if (dashes[t]) sub(/^\t+/, "", line)
          if (line == tags[t]) break
        }
      }
      nt = 0; continue
    }
    word = word c; inword = 1; i++
  }
  flush()
}
AWK
  targets=$(printf '%s' "$target" | awk "$scanner")
else
  targets=$target
fi
[ -n "$targets" ] || exit 0

payload_cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
cwd=${payload_cwd:-${CLAUDE_PROJECT_DIR:-.}}
# Plans live at the main worktree root, which a linked worktree's cwd is not.
root=$(git -C "$cwd" worktree list --porcelain 2>/dev/null | awk '/^worktree /{sub(/^worktree /, ""); print; exit}')
root=${root:-$cwd}

# A write onto an existing plan is an amendment, such as a worker rewriting a
# `- Suggested:` line, and an archive path holds a shipped plan rather than a
# new one, so only a path naming no file yet asks for the skill.
new=""
while IFS= read -r path; do
  case "$path" in
  *.canon/plans/*) ;;
  *) continue ;;
  esac
  rest=${path##*.canon/plans/}
  case "$rest" in
  '' | archive/* | *'$'* | *'*'*) continue ;;
  *.md) ;;
  *) continue ;;
  esac
  [ -e "$root/.canon/plans/$rest" ] && continue
  case "$path" in
  /*) [ -e "$path" ] && continue ;;
  esac
  new=".canon/plans/$rest"
  break
done <<EOF
$targets
EOF
[ -n "$new" ] || exit 0

# Without a session id or a readable transcript there is nothing to read the
# invocation from, and blocking on that would stop every plan, so pass.
meta=$(printf '%s' "$input" | jq -r '[.session_id // "", .transcript_path // ""] | @tsv')
session=${meta%%$'\t'*}
transcript=${meta#*$'\t'}
[ -n "$session" ] && [ -n "$transcript" ] && [ -r "$transcript" ] || exit 0

# An invocation is a Skill tool call naming the skill, or the operator typing
# its slash command, whose user line carries the command-name tag. Each one
# prints as `P <line>`, the line ordering it against the invocation the last
# new plan spent. An `auto-ship` invocation prints as `A <its arguments>`,
# since a cloud worker writes the approved plan that launch names verbatim and
# never plans it, so a write onto the path those arguments name passes.
invocations=$(grep -n -e 'plan-feature' -e 'auto-ship' "$transcript" 2>/dev/null | jq -Rr '
  def text: if type == "string" then . else (map(select(.type == "text") | .text) | join("\n")) end;
  def skill($name): .type == "tool_use" and .name == "Skill"
    and ((.input.skill // "") | test("^(canon:)?" + $name + "$"));
  def typed($name): test("<command-name>/?(canon:)?" + $name + "</command-name>");
  capture("^(?<n>[0-9]+):(?<j>.*)$") as $l
  | ($l.j | fromjson? // empty) as $o
  | if $o.type == "assistant" then
      ($o.message.content[]? | select(type == "object")
        | if skill("plan-feature") then "P \($l.n)"
          elif skill("auto-ship") then "A \(.input.args // "" | tostring)"
          else empty end)
    elif $o.type == "user" then
      (($o.message.content // "") | text)
      | if typed("plan-feature") then "P \($l.n)"
        elif typed("auto-ship") then "A \(gsub("\n"; " "))"
        else empty end
    else empty end' 2>/dev/null)

rest=${new#.canon/plans/}
key=$(printf '%s' "$session" | tr -c 'A-Za-z0-9' '_')
marker_dir="$root/.canon/tmp/hooks/plan-guard"

# One line per new plan judged, so the blocks can be counted against the passes
# before the guard is seeded. A failed write never changes the decision.
log_decision() {
  # The group takes the redirect's own error, which a `2>/dev/null` after the
  # `>>` would miss because the shell opens the file first.
  mkdir -p "$marker_dir" 2>/dev/null && {
    printf '%s %s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$key" "$rest" \
      >>"$marker_dir/decisions.log"
  } 2>/dev/null
  return 0
}

while IFS= read -r line; do
  case "$line" in
  "A "*".canon/plans/$rest"*)
    log_decision pass
    exit 0
    ;;
  esac
done <<EOF
$invocations
EOF
latest=$(printf '%s\n' "$invocations" | awk '/^P /{n = $2} END {if (n != "") print n}')

# The marker holds the line of the spent invocation and the plan it licensed.
# A PreToolUse pass is not a landed write, so a retry after a refused heredoc,
# or the `cp` that follows a worktree `Write`, lands on the same plan and
# passes on the invocation it already spent.
marker="$marker_dir/$key"
spent=0
spent_plan=""
if [ -f "$marker" ]; then
  IFS=' ' read -r spent spent_plan <"$marker" 2>/dev/null
fi
case "$spent" in '' | *[!0-9]*) spent=0 ;; esac

if [ "$spent" -gt 0 ] && [ "$spent_plan" = "$rest" ]; then
  log_decision pass
  exit 0
fi
if [ -n "$latest" ] && [ "$latest" -gt "$spent" ]; then
  mkdir -p "$marker_dir" 2>/dev/null && printf '%s %s\n' "$latest" "$rest" >"$marker" 2>/dev/null
  log_decision pass
  exit 0
fi

if [ "$spent" -gt 0 ]; then
  why='The last canon:plan-feature invocation in this session was spent on an earlier new plan'
else
  why='This session has not invoked canon:plan-feature'
fi
log_decision block
printf '%s, so %s would be written outside the skill that owns its shape. Invoke the canon:plan-feature skill for this plan, then resend the write.\n' "$why" "$new" >&2
exit 2
