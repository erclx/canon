#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-restate",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  mkdir -p docs

  # The passage below clears the ban scan and the cadence measure. Its defect is
  # comprehension: four terms of art carrying the load, one abstraction standing
  # where a mechanism belongs, three deciding facts buried among five supporting
  # ones, and one hedge a restatement must carry through rather than resolve.
  cat <<'EOF' >docs/retry.md
---
title: Retry
description: How the request layer retries a failed call and what it refuses to retry
---

# Retry

The request layer applies bounded exponential backoff with full jitter across
the idempotent surface, and the non-idempotent surface is excluded from the
policy envelope by construction rather than by configuration. Attempt budgets
are per-call rather than per-connection, so a pooled connection carries no
residual attempt state between callers.

Backoff is computed from a base interval of 200 milliseconds doubling per
attempt to a ceiling of 4 seconds, with the actual delay drawn uniformly from
zero to the computed value. The ceiling was chosen against the upstream read
timeout and has not been revalidated since that timeout moved, so the two may
no longer be aligned.

A call is retried at most three times. Retries are attempted on connection
failures and on 502, 503, and 504. A 429 carrying `Retry-After` honors the
header instead of the backoff schedule. Every other status terminates the call.

## Operational notes

The layer emits a counter per terminal outcome and a histogram of total
elapsed time inclusive of backoff. Neither is sampled. The counter cardinality
is bounded by the status set above.
EOF

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
