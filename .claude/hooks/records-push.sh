#!/usr/bin/env bash

# Claude Code sends a payload and closes stdin. A bare read with nothing feeding
# it blocks forever and holds the session open, so the read is bounded. `read`
# rather than `timeout cat`, which macOS does not ship.
IFS= read -r -d '' -t 2 input
[ -n "$input" ] || {
  printf '%s reads a Claude Code hook payload on stdin and cannot be run by hand.\n' "${0##*/}" >&2
  exit 1
}

# SessionEnd cannot block and Claude Code discards what it prints, so every
# failure past the guard exits 0 and reports on stderr, which reaches the debug
# log alone.
command -v jq >/dev/null 2>&1 || exit 0
event=$(printf '%s' "$input" | jq -r '.hook_event_name // empty' 2>/dev/null)
[ "$event" = "SessionEnd" ] || exit 0

# A session ending inside a linked worktree still pushes the main root, since
# no push reads a worktree's own `.canon/`.
root="${CLAUDE_PROJECT_DIR:-.}"
main="$root"
case "$main" in
*/.claude/worktrees/*) main="${main%/.claude/worktrees/*}" ;;
esac

# No records history is every checkout that never ran the one-time setup, so
# the hook leaves before spawning anything.
[ -d "$main/.canon/.records.git" ] || [ -d "$main/.claude/.records.git" ] || exit 0

# A checkout carrying the CLI source runs that source, so this hook and the
# build under test read one verb. The seeded copy keeps the binary alone,
# since a target has no checkout.
if [ -f "$root/src/cli.ts" ] && command -v bun >/dev/null 2>&1; then
  record=$(bun "$root/src/cli.ts" records push --root "$main" --json 2>/dev/null)
elif command -v canon >/dev/null 2>&1; then
  record=$(canon records push --root "$main" --json 2>/dev/null)
else
  printf 'Records push: resolved neither the checkout CLI nor an installed `canon` binary.\n' >&2
  exit 0
fi

reason=$(printf '%s' "$record" | jq -r 'if .ok == false then .reason // "unknown" else empty end' 2>/dev/null)
[ -n "$reason" ] && printf 'Records push: not backed up (%s). Run canon records push to retry.\n' "$reason" >&2
exit 0
