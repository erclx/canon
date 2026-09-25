#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/gov.sh"

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  mkdir -p install
  touch install/.gitkeep

  local src_rules="$PROJECT_ROOT/governance/rules"

  while IFS= read -r file; do
    local subdir
    subdir=$(rule_subdir "$file" "$src_rules")
    local rule
    rule=$(basename "$file" .md)
    local dest_dir="sync/.claude/rules/canon"
    [ -n "$subdir" ] && dest_dir="sync/.claude/rules/canon/$subdir"
    mkdir -p "$dest_dir"
    cp "$file" "$dest_dir/${rule}.md"
    echo "# stale" >>"$dest_dir/${rule}.md"
  done < <(find "$src_rules" -type f -name "*.md" | sort | head -n 2)

  mkdir -p sync/.claude/rules/canon/core sync/.claude/rules/project/core
  echo "# A rule the toolkit retired" >sync/.claude/rules/canon/core/999-retired.md
  echo "# A rule the project wrote" >sync/.claude/rules/project/core/900-local.md

  while IFS= read -r file; do
    local subdir
    subdir=$(rule_subdir "$file" "$src_rules")
    local rule
    rule=$(basename "$file" .md)
    local dest_dir="build/.claude/rules/canon"
    [ -n "$subdir" ] && dest_dir="build/.claude/rules/canon/$subdir"
    mkdir -p "$dest_dir"
    cp "$file" "$dest_dir/${rule}.md"
  done < <(find "$src_rules" -type f -name "*.md" | sort)

  # `regen/` is the one arm shaped like the toolkit rather than like a target,
  # because `gov regen` produces a repository's own consumed copy and refuses
  # nothing. It needs a stack catalog, a record, and an internal rule to reach
  # every branch the producer has.
  mkdir -p regen/internal/rules/claude regen/.claude/rules/canon/claude
  cp -R "$PROJECT_ROOT/governance" regen/governance

  cat >regen/internal/governance.toml <<'TOML'
stack = "node"
add = ["300-testing-ts"]
TOML

  cat >regen/internal/rules/claude/599-sandbox-local.md <<'RULE'
# Sandbox-local rule

## Authority

- Authored under `internal/rules/`, so it reaches this repository and no target.
RULE

  # A destination-only file the regen must delete, and a drifted copy it must
  # overwrite. Together they are the before state the run is judged against.
  echo "# orphan, no source anywhere" >regen/.claude/rules/canon/claude/999-orphan.md
  mkdir -p regen/.claude/rules/canon/core
  cp "$src_rules/core/000-constitution.md" regen/.claude/rules/canon/core/000-constitution.md
  echo "# stale" >>regen/.claude/rules/canon/core/000-constitution.md

  git add .
  git commit -m "chore(sandbox): scaffold gov test directories" --no-verify -q

  # A repository of its own, built after the outer commit so the outer tree
  # never records it as a gitlink. `test-order` reads history rather than a
  # tree, so its fixture has to be commits in an order rather than files in a
  # directory. The three commits below produce one verdict each.
  git init -q --initial-branch=main test-order
  git -C test-order config user.email "sandbox@example.com"
  git -C test-order config user.name "Sandbox"

  mkdir -p test-order/src
  echo "export const seed = 1" >test-order/src/seed.ts
  echo "// covers seed" >test-order/src/seed.test.ts
  git -C test-order add .
  git -C test-order commit -q -m "chore: seed the tree"
  git -C test-order checkout -q -b feat/parser

  echo "export const parser = 1" >test-order/src/parser.ts
  git -C test-order add .
  git -C test-order commit -q -m "feat: add the parser"

  echo "// covers parser" >test-order/src/parser.test.ts
  git -C test-order add .
  git -C test-order commit -q -m "test: cover the parser"

  echo "// covers reader" >test-order/src/reader.test.ts
  git -C test-order add .
  git -C test-order commit -q -m "test: cover the reader"

  echo "export const reader = 1" >test-order/src/reader.ts
  git -C test-order add .
  git -C test-order commit -q -m "feat: add the reader"

  echo "export const seed = 2" >test-order/src/seed.ts
  git -C test-order add .
  git -C test-order commit -q -m "refactor: rewrite the seed"

  log_step "Governance sandbox"
  log_info "install/ : clean target, no rules present"
  log_info "sync/    : stale .claude/rules/canon/ present, canon/core/999-retired.md deleted, project/core/900-local.md kept"
  log_info "build/   : full .claude/rules/ present, generates .canon/tmp/gov/rules.md"
  log_info "list     : read-only catalog dump, no target needed"
  log_info "regen/   : toolkit-shaped root, orphan and drifted rule present"
  log_info "test-order/ : own history, one pair per verdict on feat/parser"

  select_or_route_scenario "Which scenario?" "install" "sync" "build" "list" "regen" "test-order"

  case "$SELECTED_OPTION" in
  "install")
    log_step "Running: canon gov install astro --add 200-react install/"
    exec bun "$PROJECT_ROOT/src/cli.ts" gov install astro --add 200-react install/
    ;;
  "sync")
    log_step "Running: canon gov sync"
    exec bun "$PROJECT_ROOT/src/cli.ts" gov sync sync/
    ;;
  "build")
    log_step "Running: canon gov build"
    exec bun "$PROJECT_ROOT/src/cli.ts" gov build build/
    ;;
  "list")
    log_step "Running: canon gov list"
    exec bun "$PROJECT_ROOT/src/cli.ts" gov list
    ;;
  "regen")
    log_step "Running: canon gov regen --root regen/"
    # The command prints nothing on success, so the tree after it is the whole
    # result. Listed rather than exec'd for that reason.
    bun "$PROJECT_ROOT/src/cli.ts" gov regen --root regen/
    log_step "Produced regen/.claude/rules"
    find regen/.claude/rules -type f -name "*.md" | sort | sed "s|^regen/.claude/rules/||"
    log_info "599-sandbox-local.md present, 999-orphan.md gone, 000-constitution.md restored"
    ;;
  "test-order")
    # Both streams and the status land on disk, because `canon sandbox check`
    # reads the tree and nothing else. The record carries a verdict per module
    # and the status carries the exit, so the arm asserts the classification
    # separately from the code a finding is meant to produce.
    #
    # The status is held rather than left to `set -e`. A finding exits 2 by
    # design, so an abort would kill the scenario on the outcome the arm exists
    # to observe. The five arms above `exec` and leave theirs on the terminal.
    log_step "Running: canon gov test-order --root test-order"
    local order_status=0
    bun "$PROJECT_ROOT/src/cli.ts" gov test-order --root test-order --json \
      >test-order-record.json 2>test-order-frame.log || order_status=$?
    printf '%s\n' "$order_status" >test-order-status.txt
    cat test-order-frame.log >&2
    log_info "test-order-record.json carries a verdict per module"
    log_info "test-order-status.txt  carries the exit the run produced"
    log_info "Expect: declared in fixtures/infra/gov/test-order/expect.toml"
    log_info "        Check it with: canon sandbox check infra:gov test-order"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
