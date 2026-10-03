#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  stage_fixtures claude role-orchestrator shared 01-initial

  git add . && git commit -m "docs(project): requirements, tasks, and log-entry plan" --no-verify -q

  log_step "Scenario ready: orchestrator board readout"
  log_info "Context: priority.md groups the board, a plan for log-entry, none for streak-view"
  log_info "Action:  /role-orchestrator"
  log_info "Expect:  no version line at all, since no file states one,"
  log_info "         order read from priority.md rather than inferred from index.md,"
  log_info "         log-entry ready to hand to a worker (has plan), streak-view needs /plan-feature first,"
  log_info "         a single Next action, and In review omitted (no open PRs in this fixture)"
  log_info "Assert:  declared in fixtures/claude/role-orchestrator/expect.toml"
}
