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

    # Installed rather than staged, so the slides resolve the same token sheet
    # a target receives and the arm reads no copy that drifts from the source.
    canon design install . >/dev/null

    git add . && git commit -m "feat(ledger): v1 scope notes" --no-verify -q

    log_step "Scenario ready: slides draft (with project context)"
    log_info "Context: ledger CLI v1 with REQUIREMENTS, CLAUDE.md, and .claude/design/base.css present"
    log_info "Action:  /canon:draft-slides 'ledger v1 overview deck'"
    log_info "Expect:  a new folder under .canon/slides/ holding numbered .html slides drawn with var(--...) tokens"
    log_info "         and varied compositions, rendered to .canon/tmp/render/slides/, every ✗ line read back,"
    log_info "         and a one-pass QA check. Nothing written to .claude/SLIDES.md or .canon/slides/layouts/"
    ;;
  "bare")
    stage_fixtures claude draft-slides bare 01-initial

    git add . && git commit -m "chore: initial state" --no-verify -q

    log_step "Scenario ready: slides draft (no project context)"
    log_info "Context: bare repo, no CLAUDE.md, REQUIREMENTS, or token stylesheet"
    log_info "Action:  /canon:draft-slides 'toolbox launch deck'"
    log_info "Expect:  the deck still lands in its own folder under .canon/slides/ and renders, the reply says"
    log_info "         it renders unstyled rather than inventing token values, and no software or font names"
    log_info "         leak into content"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
