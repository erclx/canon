#!/usr/bin/env bash
set -e
set -o pipefail
shopt -s nullglob

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

TOOLING_ROOT="$PROJECT_ROOT/tooling"
MARKER="canon-no-seed:"

# `find` writes to stderr and returns non-zero for a missing root, inside a
# process substitution whose status nothing reads. Without this the walk covers
# nothing and the check reports every capability seeded having never read one.
if [ ! -d "$TOOLING_ROOT" ]; then
  echo "No tooling root at ${TOOLING_ROOT#"$PROJECT_ROOT/"}, capability seeding unverifiable." >&2
  exit 1
fi

failures=""

# A comment naming the marker anywhere in the source file is the recorded
# reason a capability withholds itself from every destination it was compared
# against. The reason's own prose is free-form, so only the marker is tested.
has_reason() {
  grep -q "$MARKER" "$1"
}

# Compares one source directory's files against the basenames already
# expanded from a set of destination paths. Presence on either side clears a
# name; a source file reaching neither the destination nor a marked reason is
# a capability answered on one side of the seed or config boundary and not
# the other.
check_capability() {
  local label="$1" src_dir="$2"
  shift 2

  [ -d "$src_dir" ] || return 0

  local dest_names=" "
  local dest
  for dest in "$@"; do
    [ -f "$dest" ] || continue
    dest_names="$dest_names$(basename "$dest") "
  done

  local src_file name
  for src_file in "$src_dir"/*; do
    [ -f "$src_file" ] || continue
    name=$(basename "$src_file")
    case "$dest_names" in
    *" $name "*) continue ;;
    esac
    has_reason "$src_file" && continue
    failures="$failures  $label: ${src_file#"$PROJECT_ROOT/"} reaches no seed or config and carries no $MARKER reason"$'\n'
  done
}

check_capability "Hooks" "$PROJECT_ROOT/.claude/hooks" \
  "$PROJECT_ROOT"/tooling/claude/seeds/.claude/hooks/*

check_capability "Workflows" "$PROJECT_ROOT/.github/workflows" \
  "$PROJECT_ROOT"/tooling/*/configs/.github/workflows/* \
  "$PROJECT_ROOT"/tooling/*/seeds/.github/workflows/*

check_capability "Husky" "$PROJECT_ROOT/.husky" \
  "$PROJECT_ROOT"/tooling/base/configs/.husky/*

# The reverse direction: a destination file whose source here is gone reaches
# neither check_capability above nor the wiring pass below, both of which read
# forward from the source, and it ships a target a hook, workflow, or husky
# script this repository has already deleted. A destination carrying the same
# marker clears just as a source does, which is the escape hatch a target-only
# capability needs, such as a stack-specific workflow with no root counterpart
# by design.
check_orphans() {
  local label="$1" src_dir="$2" dest_dir="$3"

  [ -d "$dest_dir" ] || return 0

  local dest_file name
  for dest_file in "$dest_dir"/*; do
    [ -f "$dest_file" ] || continue
    name=$(basename "$dest_file")
    [ -f "$src_dir/$name" ] && continue
    has_reason "$dest_file" && continue
    failures="$failures  $label: ${dest_file#"$PROJECT_ROOT/"} is seeded or configured with no source at ${src_dir#"$PROJECT_ROOT/"}/$name"$'\n'
  done
}

check_orphans "Hooks" "$PROJECT_ROOT/.claude/hooks" \
  "$PROJECT_ROOT/tooling/claude/seeds/.claude/hooks"

for dir in "$PROJECT_ROOT"/tooling/*/configs/.github/workflows \
  "$PROJECT_ROOT"/tooling/*/seeds/.github/workflows; do
  check_orphans "Workflows" "$PROJECT_ROOT/.github/workflows" "$dir"
done

check_orphans "Husky" "$PROJECT_ROOT/.husky" \
  "$PROJECT_ROOT/tooling/base/configs/.husky"

# A hook that reached the seed tree with no wiring in the seeded settings.json
# is installed dead, which fails the same way an unseeded hook does.
SEED_HOOKS_DIR="$PROJECT_ROOT/tooling/claude/seeds/.claude/hooks"
SEED_SETTINGS="$PROJECT_ROOT/tooling/claude/seeds/.claude/settings.json"

if [ -d "$SEED_HOOKS_DIR" ]; then
  if [ ! -f "$SEED_SETTINGS" ]; then
    failures="$failures  Seed settings: no settings.json at ${SEED_SETTINGS#"$PROJECT_ROOT/"} to confirm a seeded hook is wired"$'\n'
  elif ! command -v jq >/dev/null 2>&1; then
    failures="$failures  Seed settings: jq is not installed, seeded-hook wiring unverifiable"$'\n'
  else
    # Every wired command as its own path segment set, rather than a substring
    # search over the raw file, so a hook name that is a substring of another
    # hook's filename (`log.sh` inside `pr-create-log.sh`) cannot pass on a
    # neighbor's wiring.
    wired=" $(jq -r '.. | .command? // empty' "$SEED_SETTINGS" | tr '/\n' '  ') "
    for hook_file in "$SEED_HOOKS_DIR"/*.sh; do
      [ -f "$hook_file" ] || continue
      name=$(basename "$hook_file")
      case "$wired" in
      *" $name "*) continue ;;
      esac
      failures="$failures  Seed settings: $name is seeded and wired into no command in ${SEED_SETTINGS#"$PROJECT_ROOT/"}"$'\n'
    done
  fi
fi

if [ -n "$failures" ]; then
  echo "A capability reaches one side of the seed or config boundary and not the other:" >&2
  printf '%s' "$failures" >&2
  echo "Seed or configure the capability, or mark the source line with # $MARKER <reason>." >&2
  exit 1
fi
