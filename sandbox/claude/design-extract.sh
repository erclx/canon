#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "source" "greenfield"

  case "$SELECTED_OPTION" in
  "source")
    stage_fixtures claude design-extract source 01-initial

    mkdir -p .claude
    git add . && git commit -m "feat(notes): seed minimal notes app with token system" --no-verify -q

    log_step "Scenario ready: design extract from a tokenized notes app"
    log_info "Context: Vite/React notes app with CLAUDE.md personality, tokens.css, and components"
    log_info "Signals the skill should pick up:"
    log_info "  CLAUDE.md voice paragraph: calm, direct, dense, sparing accent, no animation"
    log_info "  src/styles/tokens.css: color, spacing, radius, font tokens"
    log_info "  src/components/Button.tsx: token usage in a real component"
    log_info "  REQUIREMENTS.md non-goal: no motion or transitions"
    log_info "Action 1: /canon:design-extract"
    log_info "Expect:   source path announced, canon/DESIGN.md token tables filled from tokens.css"
    log_info "Action 2: canon design render"
    log_info "Expect:   .canon/tmp/render/design/index.html with swatches, samples, and bars"
    ;;
  "greenfield")
    stage_fixtures claude design-extract greenfield 01-initial

    mkdir -p .claude
    git add . && git commit -m "chore(project): seed greenfield focus timer with personality" --no-verify -q

    log_step "Scenario ready: design extract on its greenfield path"
    log_info "Context: REQUIREMENTS.md with a Personality paragraph, ARCHITECTURE.md, no code"
    log_info "Signals the skill should pick up:"
    log_info "  Personality: quiet, disciplined, warm paper tones, single accent, no motion"
    log_info "  Non-goals: no motion or transitions"
    log_info "  Architecture: Vite plus React web app (informs typography choices)"
    log_info "Action 1: /canon:design-extract"
    log_info "Expect:   greenfield path announced, canon/DESIGN.md proposed, most cells marked ? verify"
    log_info "Action 2: canon design render"
    log_info "Expect:   .canon/tmp/render/design/index.html renders cleanly with swatches and samples"
    log_info "Expect:   every tagged cell shows a ? verify marker beside its value, never inside it"
    log_info "Expect:   the confidence line reports nearly every counted cell tagged on this path"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
