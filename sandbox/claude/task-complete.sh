#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-fixtures.sh"

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  log_info "mark    : board with three tasks, HEAD ships one task's open outcome"
  log_info "archive : board with one shipped task and one still open"

  select_or_route_scenario "Which scenario?" "mark" "archive"

  case "$SELECTED_OPTION" in
  "mark")
    stage_fixtures claude task-complete mark 01-initial
    git add . && git commit -m "feat(api): rate limit the task endpoints" --no-verify -q

    stage_fixtures claude task-complete mark 02-pagination
    git add . && git commit -m "feat(api): paginate the task list" --no-verify -q

    stage_fixtures claude task-complete mark 03-plans

    log_step "Scenario ready: closing an outcome settles no plan"
    log_info "Context: three tasks on the board, each citing a plan in .canon/plans/"
    log_info "  v02.0-pagination.md has open outcomes that HEAD ships, so this run closes it"
    log_info "  v01.0-rate-limit.md is already all [x], closed by an earlier session"
    log_info "  v03.0-search.md is the control. Its outcomes stay open."
    log_info ""
    log_info "A plan is settled by the merge rather than by a tick, and canon tasks"
    log_info "archive carries it. Narrate nothing about rate limiting. The arm fails"
    log_info "if the run moves any plan, whichever task put it in front of the run."
    log_info ""
    log_info "Action:  /canon:task-complete"
    log_info "Expect:  declared in fixtures/claude/task-complete/mark/expect.toml"
    log_info "         Check it with: canon sandbox check claude:task-complete mark"
    log_info "         One outcome marked, all three plans live, no plans archive created"
    ;;
  "archive")
    stage_fixtures claude task-complete archive 01-initial
    git add . && git commit -m "feat(api): serve the task list" --no-verify -q

    stage_fixtures claude task-complete archive 02-rate-limit
    git add . && git commit -m "feat(api): rate limit the task endpoints (#41)" --no-verify -q

    log_step "Scenario ready: one shipped task archived off a two-task board"
    log_info "Context: v01.0-rate-limit is all [x], names pull request #41, and its"
    log_info "  Plan: line points at a live .canon/plans/feature-rate-limit.md that"
    log_info "  no other task cites, so the archive carries the plan across with it"
    log_info "  HEAD carries the shipped work under a subject naming #41"
    log_info "  v02.0-pagination is the control. Its outcomes stay open, and both it"
    log_info "  and its live plan must end the run where they started."
    log_info ""
    log_info "The sandbox has no remote, so the work-reached-main check resolves"
    log_info "from the Pull request: line and the local log rather than origin/main."
    log_info ""
    log_info "Action:  /canon:task-complete archive v01.0-rate-limit"
    log_info "Expect:  declared in fixtures/claude/task-complete/archive/expect.toml"
    log_info "         Check it with: canon sandbox check claude:task-complete archive"
    log_info "         The task moved under .canon/tasks/archive/ and its plan"
    log_info "         under .canon/plans/archive/, the archived task's Plan: line"
    log_info "         retargeted a folder deeper, its ordering row cleared, and"
    log_info "         the control and its plan left where they were."
    log_info "         Two expectations need a reader and report as unchecked."
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
