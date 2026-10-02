#!/usr/bin/env bash
set -e
set -o pipefail

stage_setup() {
  git checkout -b feat/orders >/dev/null 2>&1

  stage_fixtures dev review shared orders

  git add src/api/orders.ts
  git commit -m "feat(api): add orders API" --no-verify >/dev/null

  log_step "Scenario ready: branch diff review"
  log_info "Context: on feat/orders, one commit ahead of main with three reviewable bugs"
  log_info "Action:  /canon:review-branch"
  log_info "Expect:  findings report against branch diff, no args needed"
}
