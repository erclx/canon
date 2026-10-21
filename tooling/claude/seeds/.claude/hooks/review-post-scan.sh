#!/usr/bin/env bash

# Claude Code sends a payload and closes stdin. A bare read with nothing feeding
# it blocks forever and holds the session open, so the read is bounded. `read`
# rather than `timeout cat`, which macOS does not ship.
IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

# Every Bash call reaches this line, so the command is read in one jq pass and
# matched with a shell pattern before anything else costs a process.
fields=$(printf '%s' "$input" | jq -r 'if .tool_name == "Bash" then [(.cwd // ""), (.tool_input.command // "")] | @json else empty end')
[ -n "$fields" ] || exit 0

cmd=$(printf '%s' "$fields" | jq -r '.[1]')
case "$cmd" in
*'gh api'*) ;;
*) exit 0 ;;
esac

# A command that only mentions a post is not one: a heredoc writing a review
# body that quotes the command, or a search whose pattern holds it. The string
# is cut into the commands it runs, with heredoc bodies dropped and quoted text
# left whole, and only a command that starts with `gh api` is read further.
# Splitting on the separators outside quotes is what keeps `echo 'a; gh api'`
# one command rather than two.
IFS= read -r -d '' splitter <<'AWK'
{ s = s (NR > 1 ? "\n" : "") $0 }
function emit() {
  gsub(/\n/, " ", seg)
  sub(/^[ \t]+/, "", seg)
  if (seg != "") print seg
  seg = ""
}
END {
  n = length(s); q = ""; seg = ""; nt = 0; i = 1
  while (i <= n) {
    c = substr(s, i, 1)
    if (q == "'") { seg = seg c; if (c == "'") q = ""; i++; continue }
    if (q == "\"") {
      if (c == "\\") { seg = seg c substr(s, i + 1, 1); i += 2; continue }
      if (c == "\"") q = ""
      seg = seg c; i++; continue
    }
    if (c == "\\") { seg = seg c substr(s, i + 1, 1); i += 2; continue }
    if (c == "'" || c == "\"") { q = c; seg = seg c; i++; continue }
    if (c == "#" && (seg == "" || substr(seg, length(seg), 1) ~ /[ \t]/)) {
      while (i <= n && substr(s, i, 1) != "\n") i++
      continue
    }
    if (c == "(" && substr(s, i, 2) == "((") {
      d = 0
      while (i <= n) {
        a = substr(s, i, 1)
        if (a == "(") d++
        else if (a == ")") { d--; if (d == 0) { seg = seg a; i++; break } }
        seg = seg a; i++
      }
      continue
    }
    if (c == "<" && substr(s, i, 3) == "<<<") { seg = seg "<<<"; i += 3; continue }
    if (c == "<" && substr(s, i, 2) == "<<" && seg ~ /^[ \t]*let[ \t]/) { seg = seg "<<"; i += 2; continue }
    if (c == "<" && substr(s, i, 2) == "<<") {
      j = i + 2; dash = 0
      if (substr(s, j, 1) == "-") { dash = 1; j++ }
      while (substr(s, j, 1) ~ /[ \t]/) j++
      oq = substr(s, j, 1)
      if (oq == "'" || oq == "\"") j++
      tag = ""
      while (substr(s, j, 1) ~ /[A-Za-z0-9_]/) { tag = tag substr(s, j, 1); j++ }
      if (oq == "'" || oq == "\"") j++
      if (tag != "") { nt++; tags[nt] = tag; dashes[nt] = dash; i = j; continue }
    }
    if (c == "\n") {
      emit(); i++
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
    if (c == ";" || c == "|" || c == "(" || c == ")" || c == "`" || c == "&") {
      if (c == "&" && (substr(seg, length(seg), 1) ~ /[<>]/ || substr(s, i + 1, 1) == ">")) { seg = seg c; i++; continue }
      emit(); i++; continue
    }
    seg = seg c; i++
  }
  emit()
}
AWK

# A block reaches the session through stderr, and stdout stays empty so nothing
# unframed lands in the hook protocol.
deny() {
  printf '%s\n' "$1" >&2
  exit 2
}

# The thread a review or a comment lands on: a review post or edit, and an issue
# or pull request comment post or edit. A pull request's inline comments are left
# out, since no shipped skill posts one.
seg="[^/[:space:]'\"]+"
end="(['\" ?]|\$)"
endpoint="(pulls/$seg/reviews(/$seg)?|issues/$seg/comments|issues/comments/$seg)$end"
starts_gh_api="^([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*((command|exec)[[:space:]]+)?gh[[:space:]]+api([[:space:]]|\$)"
body_inline="[[:space:]](-f|-F|--field|--raw-field)[[:space:]=]*['\"]?body="
body_file="[[:space:]](-F|--field)[[:space:]=]*['\"]?body=@([^'\"[:space:]]+)"

# Reads one command already known to start with `gh api` and returns when it
# has nothing to scan or the scan came back clean.
check() {
  local call=$1 method='' file='' cwd out code warnings

  [[ $call =~ $endpoint ]] || return 0

  # gh sends POST when a field flag is present and no method is named, and the
  # explicit method wins when one is. A call naming neither is a read.
  if [[ $call =~ [[:space:]](-X|--method)[[:space:]=]*([A-Za-z]+) ]]; then
    method=$(printf '%s' "${BASH_REMATCH[2]}" | tr '[:lower:]' '[:upper:]')
  elif [[ $call =~ [[:space:]](-f|-F|--field|--raw-field|--input)([[:space:]=]|$) ]]; then
    method=POST
  fi
  case "$method" in
  POST | PATCH | PUT) ;;
  *) return 0 ;;
  esac

  if [[ $call =~ $body_file ]]; then
    file=${BASH_REMATCH[2]}
  elif [[ $call =~ $body_inline ]]; then
    deny 'This review or comment post passes its body inline, so the label scan cannot read it. Write the body to a file in an earlier call and pass it as -F body=@<file>.'
  else
    return 0
  fi

  [ "$file" != '-' ] || deny 'This post reads its body from stdin, so the label scan cannot read it. Write the body to a file in an earlier call and pass it as -F body=@<file>.'

  if ! command -v canon >/dev/null 2>&1; then
    jq -nc '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:"The label scan did not run on this review or comment post, since canon is not on PATH. Run canon labels scan --body-file on the body once it is."}}'
    exit 0
  fi

  # The payload's own cwd is the directory a relative path was written against.
  # The project dir and this process's directory can each be a different worktree.
  cwd=$(printf '%s' "$fields" | jq -r '.[0]')
  [ -n "$cwd" ] || cwd=${CLAUDE_PROJECT_DIR:-.}
  case "$file" in
  /*) ;;
  *) file="$cwd/$file" ;;
  esac

  # A body written by the same call does not exist when this hook runs, so the
  # post would go out unread by the scan. Blocking is the only verdict that holds.
  [ -f "$file" ] || deny "The body file $file does not exist yet, so the label scan cannot read it. Write the body in an earlier call, then post it."

  # No --title: a review body carries none, and a title would grade it as an
  # ordinary pull request body.
  out=$(cd "$cwd" && canon labels scan --body-file "$file" 2>&1)
  code=$?
  [ "$code" -ne 0 ] || return 0

  warnings=$(printf '%s\n' "$out" | grep -F '!')
  [ -n "$warnings" ] || warnings=$out
  if [ "$code" -eq 2 ]; then
    deny "The label scan found text this post would publish. Fix the body file and post again.
$warnings"
  fi
  deny "The label scan could not grade $file (exit $code). Fix what it reports and post again.
$warnings"
}

commands=$(printf '%s' "$cmd" | awk "$splitter")
while IFS= read -r line; do
  [[ $line =~ $starts_gh_api ]] || continue
  check "$line"
done <<<"$commands"
exit 0
