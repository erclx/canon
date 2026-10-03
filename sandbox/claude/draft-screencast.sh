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
    stage_fixtures claude draft-screencast with-context 01-initial

    mkdir -p .claude
    git add . && git commit -m "feat(notes): v2 scope notes" --no-verify -q

    log_step "Scenario ready: screencast draft (with project context)"
    log_info "Context: notes app v2 launch with REQUIREMENTS, .canon/tasks/, and CLAUDE.md present"
    log_info "Action:  /canon:draft-screencast 'v2 inline edit launch'"
    log_info "Expect:  4 discovery questions with seeded defaults, then draft to demos/<slug>/beats.md with 9 sections and 5 pre-seeded beats"
    log_info "Expect:  the closing block names canon demo compile as the next step and the session stops there rather than compiling or recording"
    ;;
  "bare")
    stage_fixtures claude draft-screencast bare 01-initial

    git add . && git commit -m "chore: initial state" --no-verify -q

    log_step "Scenario ready: screencast draft (no project context)"
    log_info "Context: bare repo, no CLAUDE.md or .canon/tasks/"
    log_info "Action:  /canon:draft-screencast 'cli onboarding walkthrough'"
    log_info "Expect:  discovery falls back to generic defaults and the draft is still written"
    log_info "Expect:  no recording tool, editing tool, font, or window manager inside the draft, and no selector, URL, or timing on a beat"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
