#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-fixtures.sh"

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  log_info "file  : raw dump in notes/, a CLI to measure it against, one live board task"
  log_info "route : one question nobody can answer from the tree, phrased as a dump"

  select_or_route_scenario "Which scenario?" "file" "route"

  case "$SELECTED_OPTION" in
  "file")
    stage_fixtures claude plan-intake file 01-initial
    git add . && git commit -m "feat(cli): build and serve commands" --no-verify -q

    log_step "Scenario ready: a brain dump filed into an intake folder"
    log_info "Context: notes/dump.md carries seven unmeasured complaints"
    log_info "  src/ holds what they are about: console writes in three files, a"
    log_info "  log module nobody imports, and a hand-rolled flag loop in two commands"
    log_info "  CLAUDE.md already states that logs go to stderr, so one item is settled"
    log_info "  .canon/tasks/v01.0-error-envelope.md already owns the error item"
    log_info "  One item needs three builds measured, so it belongs to groundwork"
    log_info ""
    log_info "Action:  /canon:plan-intake file notes/dump.md as the cli-cleanup intake"
    log_info "Expect:  declared in fixtures/claude/plan-intake/file/expect.toml"
    log_info "         Check it with: canon sandbox check claude:plan-intake file"
    log_info "         A folder at .canon/intake/01-cli-cleanup/ with 00-overview.md"
    log_info "         carrying frontmatter, a date, and links to numbered cluster"
    log_info "         files named for their domain. Every write lands inside the"
    log_info "         folder, and the reply reports the routing split."
    log_info "         Five expectations need a reader and report as unchecked."
    ;;
  "route")
    stage_fixtures claude plan-intake route 01-initial
    git add . && git commit -m "feat(cli): build command" --no-verify -q

    log_step "Scenario ready: intake refuses a question that needs measuring"
    log_info "Context: one question, not a set of findings, and no read of the tree"
    log_info "  answers it. Costing three parser rewrites takes builds, not greps."
    log_info ""
    log_info "Action:  /canon:plan-intake should we move the CLI onto a real argument"
    log_info "         parser, and what does it cost in bundle size"
    log_info "Expect:  declared in fixtures/claude/plan-intake/route/expect.toml"
    log_info "         Check it with: canon sandbox check claude:plan-intake route"
    log_info "         The skill declines and routes to /plan-groundwork."
    log_info "         NO folder under .canon/intake/, .canon/plans/, or"
    log_info "         .canon/groundwork/."
    log_info "         Three expectations need a reader and report as unchecked."
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
