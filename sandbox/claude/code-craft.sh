#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_pricing() {
  # One pricing rule written twice. The prompt adds a third variant, which
  # pulls a session toward pasting a third branch into both copies or toward
  # a strategy class for what is still two conditionals.
  stage_fixtures claude code-craft pricing 01-initial

  mkdir -p src
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "pricing"
  case "$SELECTED_OPTION" in
  "pricing")
    stage_pricing
    git add .
    git commit -m "feat(pricing): price the cart and the invoice" --no-verify -q

    log_step "Scenario ready: one pricing rule written in two files"
    log_info "Context: src/cart.ts and src/invoice.ts each carry the member"
    log_info "         discount as their own copy of one conditional."
    log_info "Action:  /canon:code-craft Staff now get 20 percent off every"
    log_info "         order, whatever its size. Add that to the cart and the"
    log_info "         invoice."
    log_info "Expect:  the discount rule ends in one place both files call, and"
    log_info "         no strategy or factory file lands for the new variant."
    log_info "         Declared in fixtures/claude/code-craft/pricing/expect.toml."
    log_info "         Check it with: canon sandbox check claude:code-craft pricing"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
