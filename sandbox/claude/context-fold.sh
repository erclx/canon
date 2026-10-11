#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-fixtures.sh"

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "drift" "context-entries" "classify-findings"

  case "$SELECTED_OPTION" in
  "drift")
    stage_fixtures claude context-fold drift 01-initial
    git add . && git commit -m "feat(api): initial task endpoints" --no-verify -q

    stage_fixtures claude context-fold drift 02-postgres
    git add . && git commit -m "feat(api): migrate storage to Postgres and scope tasks to users" --no-verify -q

    stage_fixtures claude context-fold drift 03-plans

    log_step "Scenario ready: docs drift after a session pivot"
    log_info "Context: planning docs are stale relative to HEAD"
    log_info "  canon/context/storage.md still says SQLite, but src/db.ts now uses Postgres"
    log_info "  REQUIREMENTS.md lists 'no multi-user support' as a non-goal, but createTask now takes userId"
    log_info "  .canon/plans/feature-postgres-migration.md and feature-some-old-plan.md must stay live"
    log_info ""
    log_info "Before invoking the skill, narrate the pivot to Claude in chat:"
    log_info "  'We pivoted this session: switched storage from SQLite to Postgres,'"
    log_info "  'and promoted multi-user support from non-goal to in-scope.'"
    log_info ""
    log_info "The folded plan names the storage move as a decision of the storage domain, so canon/context/storage.md is rewritten."
    log_info "REQUIREMENTS.md stays unwritten. The fold reports the direction change and names document-health."
    log_info "The fold writes no task file. Marking the shipped outcome is task-complete's."
    log_info ""
    log_info "Action:  /context-fold"
    log_info "Expect:  declared in fixtures/claude/context-fold/drift/expect.toml"
    log_info "         Check it with: canon sandbox check claude:context-fold drift"
    log_info "         Two prose expectations need a reader and report as unchecked."
    ;;
  "context-entries")
    stage_fixtures claude context-fold context-entries 01-initial
    git add . && git commit -m "feat(web): initial chat shell" --no-verify -q

    git checkout -b feat/provider-switch -q
    stage_fixtures claude context-fold context-entries 02-provider-switch
    git add . && git commit -m "feat(web): provider switch at the gate" --no-verify -q

    stage_fixtures claude context-fold context-entries 03-plan

    log_step "Scenario ready: docs refreshes context entry from diff"
    log_info "Context: feat/provider-switch branch with diff in src/features/chat/"
    log_info "         canon/context/web.md already exists. Its Layer responsibilities section names src/features/chat/."
    log_info "Action:  /context-fold"
    log_info "Expect:  The fold reads the diff, maps src/features/chat/api-key-gate.tsx to web.md (which references that path)"
    log_info "         Rewrites the relevant section of canon/context/web.md from the diff content"
    log_info "         Does NOT create new entries (no auto-creation per design)"
    log_info "         Outputs a reminder line to run canon indexes regen"
    ;;
  "classify-findings")
    stage_fixtures claude context-fold classify-findings 01-initial
    git add . && git commit -m "feat(retrieval): document the chunk size decision" --no-verify -q

    stage_fixtures claude context-fold classify-findings 02-remeasure

    log_step "Scenario ready: context-fold classifies what it writes"
    log_info "Context: one uncommitted edit stages the shape the classify step exists to catch"
    log_info "  canon/context/retrieval.md appended a branch-narrated re-measurement"
    log_info "  below the count it restates, instead of rewriting it in place"
    log_info ""
    log_info "Narrate nothing about the edit. The arm fails if the classify step only"
    log_info "reaches a file the prompt named."
    log_info ""
    log_info "Action:  /context-fold"
    log_info "Expect:  declared in fixtures/claude/context-fold/classify-findings/expect.toml"
    log_info "         Check it with: canon sandbox check claude:context-fold classify-findings"
    log_info "         retrieval.md holds 58,500 once, the narration and 42,000 are gone"
    log_info "         Two expectations need a reader and report as unchecked."
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
