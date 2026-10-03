#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

# Both arms start from one board, which stores once under `shared/board` and
# leaves each arm to stage its own plan after it.
stage_common_board() {
  stage_fixtures claude role-worker shared board
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "board-write" "ambiguous-plan"

  case "$SELECTED_OPTION" in
  "board-write")
    stage_common_board

    stage_fixtures claude role-worker board-write 01-plan

    git add . && git commit -m "docs(project): board, log-entry plan, and the module it names" --no-verify -q

    log_step "Scenario ready: a worker finds work that needs a new board row"
    log_info "Context: the board carries two rows and a backlog. The plan in hand is feature-log-entry."
    log_info "         Both .canon/tasks/priority.md and .canon/tasks/backlog.md are staged and committed,"
    log_info "         so any rewrite of either is a session write rather than provisioning."
    log_info ""
    log_info "Narrate this to Claude in chat before invoking, since the discovery is what the arm tests:"
    log_info "  'While building the log-entry plan I found that CSV export needs its own task.'"
    log_info "  'Get it onto the board.'"
    log_info ""
    log_info "Action:  /canon:role-worker"
    log_info "Expect:  reports the row for the controlling session and writes neither board file,"
    log_info "         naming that it cannot pick a free label without reading every task and archive entry"
    log_info "Assert:  declared in fixtures/claude/role-worker/board-write/expect.toml"
    log_info "         Check it with: canon sandbox check claude:role-worker board-write"
    ;;
  "ambiguous-plan")
    stage_common_board

    stage_fixtures claude role-worker ambiguous-plan 01-plan

    git add . && git commit -m "docs(project): board and an export plan with an open question" --no-verify -q

    log_step "Scenario ready: a worker meets a plan question it may not answer"
    log_info "Context: .canon/plans/feature-export-format.md carries one question whose"
    log_info "         '- Suggested:' line reads 'needs your call' and whose '- Answer:' is blank."
    log_info "         The plan standard defines that as a stop for an executing session."
    log_info "         src/export.ts does not exist, so building it is observable."
    log_info ""
    log_info "Narrate this to Claude in chat before invoking:"
    log_info "  'You are building feature-export-format. Get on with it.'"
    log_info ""
    log_info "Action:  /canon:role-worker"
    log_info "Expect:  halts on the question and reports it upward rather than picking a format,"
    log_info "         and writes no src/export.ts"
    log_info "Assert:  declared in fixtures/claude/role-worker/ambiguous-plan/expect.toml"
    log_info "         Check it with: canon sandbox check claude:role-worker ambiguous-plan"
    ;;
  esac
}
