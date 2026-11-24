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

# Prints only the words a write lands on, after `>` or `>>`, as a `tee`
# argument, or as a `cp` target, so a command merely naming a plan passes. A scanner, not a
# parser: a path built in a variable or by `printf` passes unseen.
if [ "$kind" = B ]; then
  IFS= read -r -d '' scanner <<'AWK'
{ s = s (NR > 1 ? "\n" : "") $0 }
function endcmd() {
  if (last != "") print last
  last = ""; cmd = ""
}
function flush() {
  if (!inword) return
  if (redirect) print word
  else if (tag) { nt++; tags[nt] = word; dashes[nt] = dash }
  else if (cmd == "") {
    w = word; sub(/.*\//, "", w)
    if (w !~ /^[A-Za-z_][A-Za-z0-9_]*=/ && w !~ /^(sudo|env|command|exec|time|nice|xargs)$/) cmd = w
  }
  else if (cmd == "tee" && word !~ /^-/) print word
  else if (cmd == "cp" && word !~ /^-/) last = word
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
    if (c ~ /[;|&()<`]/) { flush(); if (c != "<") endcmd(); i++; continue }
    if (c == "\n") {
      flush(); endcmd(); i++
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
  flush(); endcmd()
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
plans_dir=$(cd "$root/.canon/plans" 2>/dev/null && pwd -P)

# Whether a path lands on the main-root plan named by `$rest`, read through
# symlinks. A path built on a variable cannot be resolved, so it counts.
at_root() {
  case "$1" in
  *'$'*) return 0 ;;
  /*) dir=${1%/*} ;;
  *) dir=$cwd/${1%/*} ;;
  esac
  [ -n "$plans_dir" ] && [ "$(cd "$dir" 2>/dev/null && pwd -P)/${1##*/}" = "$plans_dir/$rest" ]
}

# A write onto an existing plan is an amendment its owner judges below, and an
# archive path holds a shipped plan, so only a path naming no file yet asks for
# the skill.
new=""
existing=""
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
  if [ -e "$root/.canon/plans/$rest" ]; then
    [ -z "$existing" ] && at_root "$path" && existing=".canon/plans/$rest"
    continue
  fi
  case "$path" in
  /*) [ -e "$path" ] && continue ;;
  esac
  new=".canon/plans/$rest"
  break
done <<EOF
$targets
EOF
[ -n "$new" ] || [ -n "$existing" ] || exit 0

# Without a session id or a readable transcript there is nothing to read the
# invocation from, and blocking on that would stop every plan, so pass.
meta=$(printf '%s' "$input" | jq -r '[.session_id // "", .transcript_path // ""] | @tsv')
session=${meta%%$'\t'*}
transcript=${meta#*$'\t'}
[ -n "$session" ] && [ -n "$transcript" ] && [ -r "$transcript" ] || exit 0

rest=${new:-$existing}
rest=${rest#.canon/plans/}
key=$(printf '%s' "$session" | tr -c 'A-Za-z0-9' '_')
marker_dir="$root/.canon/tmp/hooks/plan-guard"

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

# A Skill call or a typed slash command prints as `P <line>`, ordered against
# the spent marker, and `auto-ship` as `A <args>`, since a worker writes the
# plan its launch names verbatim without planning it.
read_transcript() {
  lines=$(wc -l <"$transcript" 2>/dev/null | tr -d ' ')
  lines=${lines:-0}
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
  latest=$(printf '%s\n' "$invocations" | awk '/^P /{n = $2} END {if (n != "") print n}')
}

# Spends an invocation after the marker on this plan when it is the license.
licensed() {
  while IFS= read -r line; do
    case "$line" in
    "A "*".canon/plans/$rest"*) return 0 ;;
    esac
  done <<EOF
$invocations
EOF
  if [ "$spent" -gt 0 ] && [ "$spent_plan" = "$rest" ]; then
    return 0
  fi
  if [ -n "$latest" ] && [ "$latest" -gt "$spent" ]; then
    mkdir -p "$marker_dir" 2>/dev/null && printf '%s %s\n' "$latest" "$rest" >"$marker" 2>/dev/null
    return 0
  fi
  return 1
}

# One line per new plan judged, carrying the numbers it was judged on, so a
# wrong block in any project can be explained after the fact. A failed write
# never changes the decision.
log_decision() {
  # The group takes the redirect's own error, which a `2>/dev/null` after the
  # `>>` would miss because the shell opens the file first.
  mkdir -p "$marker_dir" 2>/dev/null && {
    printf '%s %s %s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$key" "$rest" "$judged" \
      >>"$marker_dir/decisions.log"
  } 2>/dev/null
  return 0
}

# No assistant `tool_use` line means the transcript format changed, so a
# caller passes and logs it apart rather than block on a read it cannot see.
parses() {
  calls=$(grep -F '"tool_use"' "$transcript" 2>/dev/null | jq -Rrn '
    first(inputs | fromjson? | select(type == "object" and .type == "assistant")
      | .message.content[]? | select(type == "object" and .type == "tool_use"
        and (.name | type) == "string") | "read") // empty' 2>/dev/null)
  [ -n "$calls" ]
}

# The owner is the session on the last `pass` line naming this plan. Another
# session must read it at or after that time, since a read taken before the
# owner's write is the race. No readable `pass` line means no owner, so pass.
if [ -z "$new" ]; then
  owned=$(awk -v plan="$rest" '$2 == "pass" && $4 == plan { at = $1; who = $3 }
    END { if (who != "") print at, who }' "$marker_dir/decisions.log" 2>/dev/null)
  [ -n "$owned" ] || exit 0
  owned_at=${owned%% *}
  owner=${owned#* }
  # A malformed owner time reads as an unreadable log line.
  owned_n=${owned_at:0:19}
  owned_n=${owned_n//[!0-9]/}
  [ "${#owned_n}" -eq 14 ] || exit 0
  read_at=-
  if [ "$owner" != "$key" ]; then
    read_at=$(grep -F '"Read"' "$transcript" 2>/dev/null | jq -Rr --arg plan "/.canon/plans/$rest" '
      fromjson? // empty | select(type == "object" and .type == "assistant")
      | .timestamp as $t | select(($t | type) == "string" and ($t | length) >= 19)
      | .message.content[]? | select(type == "object" and .type == "tool_use" and .name == "Read")
      | (.input.file_path // "" | tostring) | select(endswith($plan)) | "\($t[0:19]) \(.)"' 2>/dev/null |
      while IFS=' ' read -r stamp file; do
        [ "${file#/}" != "$file" ] && at_root "$file" && printf '%s\n' "$stamp"
      done | sort | tail -n 1)
    read_at=${read_at:--}
  fi
  judged="owner=$owner owned_at=$owned_at read_at=$read_at"
  read_n=${read_at//[!0-9]/}
  if [ "$owner" = "$key" ] || { [ "${#read_n}" -eq 14 ] && [ "$read_n" -ge "$owned_n" ]; }; then
    log_decision amend
    exit 0
  fi
  if ! parses; then
    log_decision unread
    exit 0
  fi
  log_decision block-owned
  printf 'Session %s licensed %s at %s, and this session has not read it since, so this write would replace text it never saw. Read the plan with the Read tool, then resend the write.\n' "$owner" "$existing" "$owned_at" >&2
  exit 2
fi

read_transcript
judged="latest=${latest:--} spent=$spent spent_plan=${spent_plan:--} lines=$lines"
if licensed; then
  log_decision pass
  exit 0
fi

# A change confined to the Skill input or the command tag is not caught by
# `parses`, and the guard still blocks.
if ! parses; then
  log_decision unread
  exit 0
fi

# Refusals have come on a write sent right after an invocation a later replay
# found, which fits a transcript not yet holding it, so a refusal reads once
# more after a wait well inside the hook timeout.
sleep 1
read_transcript
judged="$judged retry_latest=${latest:--} retry_lines=$lines"
if licensed; then
  log_decision pass
  exit 0
fi

if [ -z "$latest" ]; then
  why='This session has not invoked canon:plan-feature'
elif [ "$latest" -eq "$spent" ]; then
  why="The latest canon:plan-feature invocation in this session, at transcript line $latest, was spent on .canon/plans/${spent_plan:-another plan}"
else
  why="The latest canon:plan-feature invocation in this session, at transcript line $latest, is not after line $spent, which was spent on .canon/plans/${spent_plan:-another plan}"
fi
log_decision block
printf '%s, so %s would be written outside the skill that owns its shape. Invoke the canon:plan-feature skill for this plan, then resend the write. A session writing several plans invokes it once per new plan.\n' "$why" "$new" >&2
exit 2
