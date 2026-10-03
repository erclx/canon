#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "with-context" "bare"

  case "$SELECTED_OPTION" in
  "with-context")
    stage_fixtures claude draft-slides with-context 01-initial

    mkdir -p .claude
    git add . && git commit -m "feat(ledger): v1 scope notes" --no-verify -q

    log_step "Scenario ready: slides draft (with project context)"
    log_info "Context: ledger CLI v1 with REQUIREMENTS and CLAUDE.md present"
    log_info "Action:  /canon:draft-slides 'ledger v1 overview deck'"
    log_info "Expect:  .claude/SLIDES.md drafted with a bold non-blue palette and varied layouts, then rendered to .canon/tmp/render/slides/, with a one-pass QA check"
    ;;
  "bare")
    stage_fixtures claude draft-slides bare 01-initial

    git add . && git commit -m "chore: initial state" --no-verify -q

    log_step "Scenario ready: slides draft (no project context)"
    log_info "Context: bare repo, no CLAUDE.md or REQUIREMENTS"
    log_info "Action:  /canon:draft-slides 'toolbox launch deck'"
    log_info "Expect:  draft falls back to a generic palette and layouts, deck still renders, no software or font names leak into content"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
