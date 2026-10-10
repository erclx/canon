#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-fixtures.sh"

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "drift" "context-entries" "board-sweep" "classify-findings"

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
    log_info "  .canon/tasks/ has 'Migrate storage to Postgres' open, but it shipped in HEAD"
    log_info "  .canon/plans/feature-postgres-migration.md is linked from that task and must stay live"
    log_info "  .canon/plans/feature-some-old-plan.md has no task backlink and must stay live too"
    log_info ""
    log_info "Before invoking the skill, narrate the pivot to Claude in chat:"
    log_info "  'We pivoted this session: switched storage from SQLite to Postgres,'"
    log_info "  'and promoted multi-user support from non-goal to in-scope.'"
    log_info ""
    log_info "The folded plan names the storage move as a decision of the storage domain, so canon/context/storage.md is rewritten."
    log_info "REQUIREMENTS.md stays unwritten. The fold reports the direction change and names document-health."
    log_info "Task marking reads the diff, so it must land whether or not you narrate."
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
    log_info "Expect:  Step 3 updates planning docs (none diverged here)"
    log_info "         Step 5 reads the diff, maps src/features/chat/api-key-gate.tsx to web.md (which references that path)"
    log_info "         Rewrites the relevant section of canon/context/web.md from the diff content"
    log_info "         Does NOT create new entries (no auto-creation per design)"
    log_info "         Outputs a reminder line to run canon indexes regen"
    ;;
  "board-sweep")
    stage_fixtures claude context-fold board-sweep 01-initial
    git add . && git commit -m "feat(api): rate limit the task endpoints" --no-verify -q

    stage_fixtures claude context-fold board-sweep 02-pagination
    git add . && git commit -m "feat(api): paginate the task list" --no-verify -q

    stage_fixtures claude context-fold board-sweep 03-plans

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
    log_info "Action:  /context-fold"
    log_info "Expect:  declared in fixtures/claude/context-fold/board-sweep/expect.toml"
    log_info "         One outcome marked, all three plans live, no plans archive created"
    log_info "         Runs under the default turn cap. A clean run cost 28 on 2026-07-31."
    ;;
  "classify-findings")
    stage_fixtures claude context-fold classify-findings 01-initial
    git add . && git commit -m "feat(retrieval): document the chunk size decision" --no-verify -q

    stage_fixtures claude context-fold classify-findings 02-remeasure

    log_step "Scenario ready: context-fold classifies what it writes"
    log_info "Context: one uncommitted edit stages the shape Step 9 exists to catch"
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
