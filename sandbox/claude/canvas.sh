#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  log_step "Canvas sandbox"
  log_info "open: a project with the design stylesheet installed and no canvas yet"
  log_info ""
  log_info "Invoke the prefixed form. The dev-skill injection copies SKILL.md alone,"
  log_info "so the unprefixed copy cannot resolve the bundled standards/canvas.md."
  log_info "Launch with: claude --plugin-dir <worktree-root>/claude --model sonnet"

  select_or_route_scenario "Which scenario?" "open"

  case "$SELECTED_OPTION" in
  "open")
    stage_fixtures claude canvas open 01-project

    # Installed rather than staged, so the frames resolve the same token sheet
    # a target receives and the arm reads no copy that drifts from the source.
    canon design install . >/dev/null

    git add . && git commit -m "feat(plans): list the pricing tiers" --no-verify -q

    log_step "Scenario ready: canvas draws a first frame from nothing"
    log_info "Context: no canvas server is running and .canon/canvas/ does not exist"
    log_info "  The project carries .claude/design/base.css, so a frame has tokens"
    log_info "  to draw with, and src/index.ts names three pricing tiers to draw"
    log_info ""
    log_info "Action:  /canon:canvas draw the pricing tiers from src/index.ts as one"
    log_info "         frame named pricing on a page named drafts, then capture it"
    log_info "Expect:  declared in fixtures/claude/canvas/open/expect.toml"
    log_info "         Check it with: canon sandbox check claude:canvas open"
    log_info "         The session starts the server before writing the frame and"
    log_info "         checks the shell at the address it printed. A frame at"
    log_info "         .canon/canvas/drafts/pricing.html drawn with var(--...)"
    log_info "         tokens, its box in drafts/layout.json, and the reply naming"
    log_info "         the canvas address. The frame is marked as being edited"
    log_info "         before the write and cleared after, leaving"
    log_info "         .canon/canvas/editing.json empty. Nothing written outside .canon/."
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
