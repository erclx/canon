#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_shop_config() {
  stage_fixtures claude test-craft shared shop-config
}

stage_layers() {
  mkdir -p src/lib src/components src/pages e2e

  # One behavior per layer, so a correct run has exactly one right home for
  # each. The helper is pure, which makes it a unit test. The list's loading,
  # empty, and error states render without leaving the component, which makes
  # them a component test however much the diff looks like UI. The checkout
  # crosses three routes, which is the one journey here that earns a browser.
  stage_fixtures claude test-craft layers 01-initial
}

stage_pull() {
  mkdir -p src/pages e2e

  # The page already carries an end to end spec, which is the pull. A session
  # adding to a page with a spec beside it is tempted to extend that spec. The
  # loading state renders without leaving the component, so the right home is
  # a component test, and the spec must stay free of it.
  stage_fixtures claude test-craft pull 01-initial
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "layers" "pull"

  stage_shop_config

  case "$SELECTED_OPTION" in
  "layers")
    stage_layers
    git add .
    git commit -m "feat(shop): add prices, the order list, and checkout" --no-verify -q

    log_step "Scenario ready: three untested behaviors, one per layer"
    log_info "Context: src/lib/price.ts is pure, src/components/OrderList.tsx has a"
    log_info "         loading, empty, and error state, and src/App.tsx routes a checkout"
    log_info "         from /cart through /checkout to /confirmation. Nothing is tested."
    log_info "Action:  /canon:test-craft Write the tests formatPrice, the OrderList"
    log_info "         states, and the checkout flow need."
    log_info "Expect:  a unit test beside price.ts, a component test beside OrderList"
    log_info "         covering its three states, and one Playwright spec under e2e/"
    log_info "         walking the checkout. No browser test asserts the loading state."
    log_info "         Declared in fixtures/claude/test-craft/layers/expect.toml."
    log_info "         Check it with: canon sandbox check claude:test-craft layers"
    log_info ""
    log_info "Nothing installs, so no test can run. The arm asserts where each test"
    log_info "landed, not whether it passed."
    ;;
  "pull")
    stage_pull
    git add .
    git commit -m "feat(shop): add the orders page and its spec" --no-verify -q

    log_step "Scenario ready: a page under end to end coverage, a state to add"
    log_info "Context: src/pages/Orders.tsx has no loading state, and"
    log_info "         e2e/orders.spec.ts already covers the list in a browser."
    log_info "Action:  /canon:test-craft Add a loading state to the Orders page and"
    log_info "         write the tests it needs."
    log_info "Expect:  a component test beside Orders asserting the loading state,"
    log_info "         and no mention of it in e2e/orders.spec.ts."
    log_info "         Declared in fixtures/claude/test-craft/pull/expect.toml."
    log_info "         Check it with: canon sandbox check claude:test-craft pull"
    log_info ""
    log_info "Naming an arm is what makes the check assert anything. Without one,"
    log_info "canon sandbox check claude:test-craft reports clean with nothing read."
    log_info "The without arm is a hand run against a scratch plugin dir lacking"
    log_info "skills/test-craft, since run.sh hardcodes --plugin-dir claude, and it"
    log_info "is scored by reading the files it wrote, not by this check."
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
