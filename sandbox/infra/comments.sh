#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-git.sh"

seed_source_tree() {
  stage_fixtures infra comments shared source-tree
}

# The regression arm. Every `#` inside the heredoc below is a markdown heading
# in fixture data, and counting it as a bash comment is what turned a measured
# 112 comment lines into 427 during the comment-discipline track.
seed_heredoc_scenario() {
  stage_fixtures infra comments heredoc 01-scenario
}

seed_vocabulary_rule() {
  stage_fixtures infra comments vocabulary 01-rule
}

seed_degraded_source() {
  stage_fixtures infra comments shared degraded-source
}

seed_history() {
  seed_source_tree
  git init -q
  configure_sandbox_git_identity
  git add . && git commit -q -m "chore: seed uncommented source"

  stage_fixtures infra comments trend 01-document-beta

  git add . && git commit -q -m "docs: document the beta contract"
}

stage_setup() {
  log_step "Comments sandbox"
  log_info "snapshot   : density by language and by comment kind"
  log_info "heredoc    : heredoc bodies are data, not bash comments"
  log_info "vocabulary : sweep reads its terms from an installed rule"
  log_info "skipped    : no rule means the sweep reports skipped, not clean"
  log_info "trend      : recomputes the series from git with no ledger"
  log_info "json       : machine record on stdout, frame still on stderr"

  select_or_route_scenario "Which scenario?" "snapshot" "heredoc" "vocabulary" "skipped" "trend" "json"

  case "$SELECTED_OPTION" in
  "snapshot")
    seed_source_tree
    log_step "Running: canon comments scan"
    bun "$PROJECT_ROOT/src/cli.ts" comments scan
    log_info "Expect: TypeScript 4 comment lines, 1 doc block, 1 inline"
    log_info "Expect: the https:// literal is not counted as a comment"
    ;;
  "heredoc")
    seed_heredoc_scenario
    log_step "Running: canon comments scan"
    bun "$PROJECT_ROOT/src/cli.ts" comments scan
    log_info "Expect: Bash 1 comment line, not 5"
    log_info "Expect: the shebang is excluded and heredoc lines leave the total"
    ;;
  "vocabulary")
    seed_vocabulary_rule
    seed_degraded_source
    log_step "Running: canon comments scan"
    bun "$PROJECT_ROOT/src/cli.ts" comments scan
    log_info "Expect: hits for TODO and previously, sourced from the rule"
    log_info "Expect: the TODO inside the string literal is not a hit"
    ;;
  "skipped")
    seed_degraded_source
    log_step "Running: canon comments scan"
    bun "$PROJECT_ROOT/src/cli.ts" comments scan
    log_info "Expect: sweep reported skipped rather than zero hits"
    ;;
  "trend")
    seed_history
    log_step "Running: canon comments scan --since HEAD~1"
    bun "$PROJECT_ROOT/src/cli.ts" comments scan --since HEAD~1
    log_info "Expect: a two-point series with comment lines rising"
    log_info "Expect: no ledger file written anywhere in the tree"
    ;;
  "json")
    seed_source_tree
    log_step "Running: canon comments scan --json"
    exec bun "$PROJECT_ROOT/src/cli.ts" comments scan --json
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
