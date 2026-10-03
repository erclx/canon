#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  stage_fixtures claude session-compact shared 01-initial

  git add . && git commit -m "feat(api): scaffold the task API and its board" --no-verify -q

  log_step "Scenario ready: a plain session that only reasoned, about to compact"
  log_info "Context: the session compared cursor and offset pagination and settled"
  log_info "  on a cursor, and changed no source. The prompt states that reasoning,"
  log_info "  since a cold sandbox holds none of its own."
  log_info ""
  log_info "Action:  /canon:session-compact the task list needs pagination. We measured"
  log_info "         offset paging against a cursor, chose the cursor because an insert"
  log_info "         between two page reads shifts every offset row, and left the page"
  log_info "         size open. Write the handoff, we are about to compact."
  log_info "Expect:  declared in fixtures/claude/session-compact/expect.toml"
  log_info "         Check it with: canon sandbox check claude:session-compact"
  log_info "         One note under .canon/compact/, nothing new under .canon/tasks/,"
  log_info "         and no ## State section in the note."
}
