#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-fixtures.sh"

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "drift" "context-entries" "wireframe-coverage" "anchor-sweep" "board-sweep" "classify-findings"

  case "$SELECTED_OPTION" in
  "drift")
    stage_fixtures claude context-fold drift 01-initial
    git add . && git commit -m "feat(api): initial task endpoints" --no-verify -q

    stage_fixtures claude context-fold drift 02-postgres
    git add . && git commit -m "feat(api): migrate storage to Postgres and scope tasks to users" --no-verify -q

    stage_fixtures claude context-fold drift 03-plans

    log_step "Scenario ready: docs drift after a session pivot"
    log_info "Context: planning docs are stale relative to HEAD"
    log_info "  ARCHITECTURE.md still says SQLite, but src/db.ts now uses Postgres"
    log_info "  REQUIREMENTS.md lists 'no multi-user support' as a non-goal, but createTask now takes userId"
    log_info "  .canon/tasks/ has 'Migrate storage to Postgres' open, but it shipped in HEAD"
    log_info "  .canon/plans/feature-postgres-migration.md is linked from that task and must stay live"
    log_info "  .canon/plans/feature-some-old-plan.md has no task backlink and must stay live too"
    log_info ""
    log_info "Before invoking the skill, narrate the pivot to Claude in chat:"
    log_info "  'We pivoted this session: switched storage from SQLite to Postgres,'"
    log_info "  'and promoted multi-user support from non-goal to in-scope.'"
    log_info ""
    log_info "The folded plan names the storage move as a slot decision, so ARCHITECTURE.md is rewritten."
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
    log_info "         Step 4 reads the diff, maps src/features/chat/api-key-gate.tsx to web.md (which references that path)"
    log_info "         Rewrites the relevant section of canon/context/web.md from the diff content"
    log_info "         Does NOT create new entries (no auto-creation per design)"
    log_info "         Outputs a reminder line to run canon indexes regen"
    ;;
  "wireframe-coverage")
    rm -f canon/wireframes/feature-name.md
    stage_fixtures claude context-fold wireframe-coverage 01-initial
    git add . && git commit -m "feat(web): initial BYOK gate" --no-verify -q

    git checkout -b feat/widen-and-mock -q
    stage_fixtures claude context-fold wireframe-coverage 02-widen
    git add . && git commit -m "feat(web): widen BYOK to three providers and add mock demo strip" --no-verify -q

    log_step "Scenario ready: docs wireframe coverage sweep"
    log_info "Context: branch widens BYOK gate to three providers and adds a new mock demo surface"
    log_info "  canon/wireframes/byok-gate.md still says Anthropic-only"
    log_info "  src/features/mock/MockDemoStrip.tsx has no matching wireframe surface"
    log_info ""
    log_info "Action:  /context-fold"
    log_info "Expect:  Step 4 reports drift in canon/wireframes/byok-gate.md (Anthropic-only contradicted)"
    log_info "         Step 4 stubs canon/wireframes/mock-demo-strip.md with a TODO"
    log_info "         Operator resolves drift manually; auto-rewrite of prose is out of scope"
    ;;
  "anchor-sweep")
    # The fixture record overwrites the seeded canon/ARCHITECTURE.md in place.
    # No delete first, unlike an arm keying on a path entering the tree: nothing here keys on the file
    # being added, so the branch diff is the same either way.
    stage_fixtures claude context-fold anchor-sweep 01-initial
    # `git init` runs without `-b`, so the baseline branch follows the machine's
    # init.defaultBranch. The sweep resolves its diff against `main` by name, and
    # on a machine naming it otherwise the baseline comes out unusable, the
    # fallback set is empty because everything is committed, and Step 6 skips.
    git branch -M main
    git add -A && git commit -m "feat(gov): install rules into a target project" --no-verify -q

    git checkout -b feat/widen-the-catalog -q
    stage_fixtures claude context-fold anchor-sweep 02-widen
    git add . && git commit -m "feat(gov): widen the bundled catalog and scope sync to a stack" --no-verify -q

    log_step "Scenario ready: docs architecture anchor sweep"
    log_info "Context: the branch moves a number three decisions cite, two anchored and one not"
    log_info "  The install decision is anchored and cites src/gov/install.ts, which goes from 4 rules to 6"
    log_info "  The drift decision cites src/gov/sync.ts, which this branch also edits, and carries no anchor"
    log_info "  The planner decision is anchored and cites src/gov/plan.ts, which this branch never touches"
    log_info "  The one-file decision is anchored and cites CLAUDE.md, a root file going from 2 rules to 4"
    log_info ""
    log_info "Narrate nothing about the catalog. The arm fails if the sweep only"
    log_info "reaches an entry the prompt named, and it fails the other way if it"
    log_info "flags the unanchored entry or the entry no signal points at."
    log_info ""
    log_info "Action:  /context-fold"
    log_info "Expect:  declared in fixtures/claude/context-fold/anchor-sweep/expect.toml"
    log_info "         Check it with: canon sandbox check claude:context-fold anchor-sweep"
    log_info "         Two reported entries, and canon/ARCHITECTURE.md unwritten:"
    log_info "         no anchor refreshed, none added, no claim edited beside one"
    log_info "         Two expectations need a reader and report as unchecked."
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
    log_info "Context: two uncommitted edits stage two shapes Step 10 exists to catch"
    log_info "  canon/context/retrieval.md appended a branch-narrated re-measurement"
    log_info "  below the count it restates, instead of rewriting it in place"
    log_info "  canon/wireframes/search-panel.md appended a bullet naming the source"
    log_info "  file that implements it, which is a MOVE finding rather than a REPLACE"
    log_info "  or a HISTORY one, and nothing but Step 10 touches a wireframe this way"
    log_info ""
    log_info "Narrate nothing about either edit. The arm fails if the classify step only"
    log_info "reaches a file the prompt named."
    log_info ""
    log_info "Action:  /context-fold"
    log_info "Expect:  declared in fixtures/claude/context-fold/classify-findings/expect.toml"
    log_info "         Check it with: canon sandbox check claude:context-fold classify-findings"
    log_info "         retrieval.md holds 58,500 once, the narration and 42,000 are gone"
    log_info "         search-panel.md keeps its behavior bullets, the source-file mention gone"
    log_info "         Three expectations need a reader and report as unchecked."
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
