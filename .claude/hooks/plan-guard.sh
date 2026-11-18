#!/usr/bin/env bash

# A new plan passes only on an unspent `canon:plan-feature` invocation or an
# `auto-ship` naming its path, since a heredoc loads no path-scoped rule. It
# backs the rule up, since a hook fails open on a timeout or an unread input.
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

# Prints only the words a write lands on, after `>` or `>>` or as a `tee` or
# `cp` argument, so a command merely naming a plan passes. A scanner, not a
# parser: a path built in a variable or by `printf` passes unseen.
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

# A Skill call or a typed slash command prints as `P <line>`, ordered against
# the spent marker, and `auto-ship` as `A <args>`, since a worker writes the
# plan its launch names verbatim without planning it.
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

# One line per new plan judged, so a wrong block in any project shows up beside
# the passes and the unread ones. A failed write never changes the decision.
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

# The marker holds the spent invocation's line and the plan it licensed, so a
# retry or the `cp` after a worktree `Write` passes on the same plan, since a
# PreToolUse pass is not a landed write.
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

# No assistant `tool_use` line means the transcript format changed, so pass
# and log it apart rather than block every plan. A change confined to the Skill
# input or the command tag is not caught here, and the guard still blocks.
calls=$(grep -F '"tool_use"' "$transcript" 2>/dev/null | jq -Rrn '
  first(inputs | fromjson? | select(type == "object" and .type == "assistant")
    | .message.content[]? | select(type == "object" and .type == "tool_use"
      and (.name | type) == "string") | "read") // empty' 2>/dev/null)
if [ -z "$calls" ]; then
  log_decision unread
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
