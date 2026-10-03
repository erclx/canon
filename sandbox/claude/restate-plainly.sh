#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  # The passage in docs/retry.md clears the ban scan and the cadence measure. Its
  # defect is comprehension: four terms of art carrying the load, one abstraction
  # standing where a mechanism belongs, three deciding facts buried among five
  # supporting ones, and one hedge a restatement must carry through rather than
  # resolve.
  stage_fixtures claude restate-plainly shared 01-initial

  git add . && git commit -m "docs(retry): describe the request retry policy" --no-verify -q

  log_step "Scenario ready: a dense document a reader has to decode before deciding"
  log_info "Context: docs/retry.md, committed, dense in comprehension rather than in cadence:"
  log_info "  1. Four terms of art carry the load: idempotent surface, policy envelope,"
  log_info "     attempt budget, residual attempt state"
  log_info "  2. One abstraction stands where a mechanism belongs: excluded by construction"
  log_info "  3. Three deciding facts sit among five supporting ones: three retries, which"
  log_info "     statuses retry, and Retry-After winning over the schedule"
  log_info "  4. One hedge must survive: the ceiling may no longer match the read timeout"
  log_info "Action:  /canon:restate-plainly docs/retry.md"
  log_info "Expect:  a plain restatement in chat and no file written, keeping the three"
  log_info "         deciding facts and the hedge, dropping the jitter arithmetic and the"
  log_info "         metrics section, and closing with a Cut: line naming what left."
}
