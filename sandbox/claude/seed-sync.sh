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
  "name": "sandbox-seed-sync",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  git add . && git commit -m "chore(project): init" --no-verify -q

  if [ -f "CLAUDE.md" ]; then
    if ! grep -q '^## Commands' CLAUDE.md; then
      log_error "CLAUDE.md carries no ## Commands heading, so the truncation has nothing to cut at."
    fi
    sed -i '/^## Commands/,$d' CLAUDE.md

    if ! grep -q 'Pick which from the index anchors below\.' CLAUDE.md; then
      log_error "CLAUDE.md carries no anchors sentence to mutate, so the drift stage would stage nothing."
    fi
    sed -i 's/Pick which from the index anchors below\./Pick which from the index below./' CLAUDE.md
  fi

  # No standards drift is staged. The corpus installs into no target, so the
  # skill's seed stage is the whole of what it audits here.
  #
  # An explicit branch rather than whatever `git init` inherited. The proposal
  # filename carries the slug, so leaving it on the machine's `init.defaultBranch`
  # would make the expectation pass or fail by local git config.
  git checkout -b chore/seed-drift -q

  git add . && git commit -m "chore(claude): trim CLAUDE.md and drift the seeds" --no-verify -q

  log_step "Scenario ready: seed sync with seed drift"
  log_info "Context: project with installed seeds, CLAUDE.md truncated, one Context bullet mutated"
  log_info "Action:  /seed-sync"
  log_info "Expect:  drift report covering the seeds, scope table grouped by source"
}
