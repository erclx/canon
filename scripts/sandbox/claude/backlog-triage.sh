#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-fixtures.sh"

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_history() {
  stage_fixtures claude backlog-triage file 01-initial
  git add . && git commit -m "feat(api): serve the task list" --no-verify -q

  stage_fixtures claude backlog-triage file 02-paginate
  git add . && git commit -m "feat(api): paginate the task list (#61)" --no-verify -q

  stage_fixtures claude backlog-triage file 03-export
  git add . && git commit -m "feat(api): add a CSV export for the weekly report (#58)" --no-verify -q
}

stage_setup() {
  log_info "file  : six backlog rows, one per verdict shape, and a tree to measure them against"
  log_info "apply : the same board plus an answered triage folder carrying one override"

  select_or_route_scenario "Which scenario?" "file" "apply"

  case "$SELECTED_OPTION" in
  "file")
    stage_history

    log_step "Scenario ready: every backlog row filed with a verdict"
    log_info "Context: .canon/tasks/backlog.md lists six rows, and priority.md holds"
    log_info "  one control row, v07.0, that a triage never files"
    log_info "  v01.0 names console.log calls the tree no longer holds"
    log_info "  v02.0's outcomes shipped in #58 under other work"
    log_info "  v03.0's missing rate limit still reproduces"
    log_info "  v04.0 waited on pagination, which landed in #61"
    log_info "  v05.0 and v06.0 carry no argument, since no interface or webhook exists"
    log_info ""
    log_info "Action:  /canon:backlog-triage"
    log_info "Expect:  declared in fixtures/claude/backlog-triage/file/expect.toml"
    log_info "         Check it with: canon sandbox check claude:backlog-triage file"
    log_info "         A folder at .canon/intake/01-backlog-triage/ with one item per"
    log_info "         row, a verdict token opening every Suggested: line, and every"
    log_info "         You: slot empty. The board is untouched."
    log_info "         Then: canon intake list 01-backlog-triage --json"
    ;;
  "apply")
    stage_history
    stage_fixtures claude backlog-triage apply 01-answered

    log_step "Scenario ready: an answered triage folder applied to the board"
    log_info "Context: .canon/intake/01-backlog-triage/ carries six answered items"
    log_info "  Four accept their suggestion with ok: decline v01.0, archive v02.0"
    log_info "  at positions 1 and 2, keep v03.0, and promote v04.0"
    log_info "  v05.0 overrides a suggested decline with keep"
    log_info "  v06.0 carries a free-text answer, which apply must skip, not guess"
    log_info ""
    log_info "Action:  /canon:backlog-triage"
    log_info "Expect:  declared in fixtures/claude/backlog-triage/apply/expect.toml"
    log_info "         Check it with: canon sandbox check claude:backlog-triage apply"
    log_info "         v01.0 under declined/, v02.0 under archive/ with both outcomes"
    log_info "         closed, v04.0 at the bottom of Needs a plan, v03.0 and v05.0"
    log_info "         still live with a triage Findings line, v06.0 untouched."
    log_info "         Then: canon tasks list --json and canon tasks validate"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
