#!/usr/bin/env bash

TOOLING_STACK_EXCLUDE=("claude")

is_tooling_stack_excluded() {
  local name="$1"
  local excluded
  for excluded in "${TOOLING_STACK_EXCLUDE[@]}"; do
    if [ "$name" = "$excluded" ]; then
      return 0
    fi
  done
  return 1
}

list_tooling_stacks() {
  local tooling_dir="${1:-$PROJECT_ROOT/tooling}"
  local name
  while IFS= read -r entry; do
    name=$(basename "$entry")
    is_tooling_stack_excluded "$name" && continue
    echo "$name"
  done < <(find "$tooling_dir" -mindepth 1 -maxdepth 1 -type d | sort)
}

# Seed roots that carry a `.claude/` or a `canon/`, emitted relative to
# `PROJECT_ROOT`. Every stage measuring seed content discovers through this
# rather than naming a stack, so a stack seeding either root later arrives
# covered with no edit to any caller. A stack seeding only tracked surfaces
# carries `canon/` alone, which a `.claude/` test would drop from both stages.
collect_seed_roots() {
  local dir
  for dir in "$PROJECT_ROOT"/tooling/*/seeds; do
    [ -d "$dir/.claude" ] || [ -d "$dir/canon" ] || continue
    printf '%s\n' "${dir#"$PROJECT_ROOT"/}"
  done
}
