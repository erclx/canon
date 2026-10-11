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

# The thread a review or a comment lands on: a review post or edit, and an issue
# or pull request comment post or edit. A pull request's inline comments are left
# out, since no shipped skill posts one.
seg="[^/[:space:]'\"]+"
end="(['\" ?]|\$)"
endpoint="(pulls/$seg/reviews(/$seg)?|issues/$seg/comments|issues/comments/$seg)$end"
[[ $cmd =~ $endpoint ]] || exit 0

# gh sends POST when a field flag is present and no method is named, and the
# explicit method wins when one is. A call naming neither is a read.
method=''
if [[ $cmd =~ (-X|--method)[[:space:]=]*([A-Za-z]+) ]]; then
  method=$(printf '%s' "${BASH_REMATCH[2]}" | tr '[:lower:]' '[:upper:]')
elif [[ $cmd =~ [[:space:]](-f|-F|--field|--raw-field|--input)([[:space:]=]|$) ]]; then
  method=POST
fi
case "$method" in
POST | PATCH | PUT) ;;
*) exit 0 ;;
esac

# A block reaches the session through stderr, and stdout stays empty so nothing
# unframed lands in the hook protocol.
deny() {
  printf '%s\n' "$1" >&2
  exit 2
}

body_inline="[[:space:]](-f|-F|--field|--raw-field)[[:space:]=]*['\"]?body="
body_file="[[:space:]](-F|--field)[[:space:]=]*['\"]?body=@([^'\"[:space:]]+)"

file=''
if [[ $cmd =~ $body_file ]]; then
  file=${BASH_REMATCH[2]}
elif [[ $cmd =~ $body_inline ]]; then
  deny 'This review or comment post passes its body inline, so the label scan cannot read it. Write the body to a file in an earlier call and pass it as -F body=@<file>.'
else
  exit 0
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
[ "$code" -ne 0 ] || exit 0

warnings=$(printf '%s\n' "$out" | grep -F '!')
[ -n "$warnings" ] || warnings=$out
if [ "$code" -eq 2 ]; then
  deny "The label scan found text this post would publish. Fix the body file and post again.
$warnings"
fi
deny "The label scan could not grade $file (exit $code). Fix what it reports and post again.
$warnings"
