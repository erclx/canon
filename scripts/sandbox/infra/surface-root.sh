#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

# The old root sits in a variable so the sweep this sandbox exercises never reads
# its own seeding lines as citations to rewrite when it runs over the toolkit.
OLD_ROOT=".claude"

# Tracked surfaces at the old root, one citing file outside them, and one
# vendor-read folder the move must leave where it is. Staged rather than
# committed, since `git mv` needs the paths tracked and nothing more.
seed_surfaces() {
  mkdir -p "$OLD_ROOT/context" "$OLD_ROOT/wireframes" "$OLD_ROOT/rules/core" docs

  printf '# Architecture\n' >"$OLD_ROOT/ARCHITECTURE.md"
  printf -- '---\ntitle: Context\ndescription: Per-domain narrative\n---\n\n# Context\n' >"$OLD_ROOT/context/index.md"
  printf '# Wireframes\n\nSee `%s/context/index.md`.\n' "$OLD_ROOT" >"$OLD_ROOT/wireframes/index.md"
  printf '# Behavior\n' >"$OLD_ROOT/rules/core/005-behavior.md"
  printf 'Start at `%s/context/index.md`.\n' "$OLD_ROOT" >docs/guide.md

  git add -A
}

run_cli() {
  local status=0
  bun "$PROJECT_ROOT/src/cli.ts" "$@" || status=$?
  log_info "Exit code: $status"
}

stage_setup() {
  log_step "Surface root sandbox"
  log_info "report     : the plan against an unmoved tree, nothing written"
  log_info "write      : the move applied with git mv and the citations rewritten"
  log_info "idempotent : a second run over the moved tree, rewriting nothing"
  log_info "unmoved    : a tree the verb never ran in, still resolving the old root"

  select_or_route_scenario "Which scenario?" "report" "write" "idempotent" "unmoved"

  case "$SELECTED_OPTION" in
  "report")
    seed_surfaces
    log_step "Running: canon migrate surface-roots --root ."
    run_cli migrate surface-roots --root . --json
    log_info "Expect: exit 2, moves 3, and wrote false"
    log_info "Expect: docs/guide.md and the wireframes index each carrying 1 rewrite"
    find . -not -path './.git/*' -type f | sort
    log_info "Expect: every surface still under the old root"
    ;;
  "write")
    seed_surfaces
    log_step "Running: canon migrate surface-roots --root . --write"
    run_cli migrate surface-roots --root . --write --json
    log_step "Reading the index back"
    git status --short
    log_info "Expect: three renames into canon/, reported by git as R rather than a delete and an add"
    cat docs/guide.md
    log_info "Expect: the citation spelling canon/context/index.md"
    find . -not -path './.git/*' -type f | sort
    log_info "Expect: rules/core/005-behavior.md still under the old root"
    ;;
  "idempotent")
    seed_surfaces
    run_cli migrate surface-roots --root . --write --json
    git add -A
    log_step "Running: canon migrate surface-roots --root . (second run)"
    run_cli migrate surface-roots --root . --json
    log_info "Expect: exit 0, moves 0, rewritten 0, and an empty paths list"
    ;;
  "unmoved")
    seed_surfaces
    log_step "Running: canon context audit . --json"
    run_cli context audit . --json
    log_info "Expect: the context folder resolved under the old root, since nothing moved it"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
