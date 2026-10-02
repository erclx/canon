#!/usr/bin/env bash
set -e
set -o pipefail

stage_setup() {
  stage_fixtures dev comment shared orders

  log_step "Scenario ready: dev:comment above-block comments test"
  log_info "Context: 'src/api/orders.ts' has three functions, no existing comments"
  log_info "Action:  /dev:comment src/api/orders.ts"
  log_info "Expect:  comment added to MAX_BULK and bulkFulfil. getOrder and cancelOrder left clean"
}
