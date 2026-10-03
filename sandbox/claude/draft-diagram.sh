#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  # Two entries already drawn and still accurate. Only the deploy signal moves, so
  # a conforming pass rewrites deployment.md and nothing else. These are the
  # siblings the checksum baseline protects. The deploy topology gained a worker
  # service in docker-compose.yml, so deployment.md is the one entry a conforming
  # pass has reason to write.
  stage_fixtures claude draft-diagram shared 01-initial

  # Baseline for the untouched assertion. The scenario's core claim is that a
  # deploy refresh leaves siblings byte-identical, which needs a recorded
  # before-state to be checkable rather than eyeballed.
  sha256sum .canon/diagrams/components.md .canon/diagrams/data-pipeline.md \
    >fixtures/siblings.sha256

  git add . && git commit -m "feat(sandbox): seed two-folder app with two drawn diagram entries" --no-verify -q

  log_step "Scenario ready: refresh one diagram entry without disturbing its siblings"
  log_info "Context: web/ + api/ + SQLite, two entries already drawn under .canon/diagrams/"
  log_info "Signals the skill should pick up:"
  log_info "  docker-compose.yml gained a worker service → deployment is the stale kind"
  log_info "  canon/REQUIREMENTS.md names reviewers, an LLM provider, a compliance export → system context has no entry yet"
  log_info "  components.md and data-pipeline.md still match ARCHITECTURE.md → neither has a reason to change"
  log_info "Action: /canon:draft-diagram refresh the deployment diagram"
  log_info "Expect: .canon/diagrams/deployment.md written, with title, description, and category frontmatter"
  log_info "Expect: components.md and data-pipeline.md byte-identical afterward"
  log_info "  Assert it: sha256sum -c fixtures/siblings.sha256"
  log_info "Expect: .canon/diagrams/index.md regenerated, entries grouped under category headings"
  log_info "Expect: chat output names the untouched entries rather than reporting them as written"
  log_info "Expect: PNG render under .canon/tmp/diagrams/ for deployment alone, not for the siblings"
  log_info "Second pass: /canon:draft-diagram draw the system context"
  log_info "  Expect: system-context.md drawn from REQUIREMENTS.md, showing actors outside the boundary"
  log_info "  Expect: siblings.sha256 still verifies"
  log_info "Known-bad fixture: fixtures/known-bad.mmd passes every source rule and fails three ways rendered"
  log_info "  Render it to see the failure: bunx -y @mermaid-js/mermaid-cli -i fixtures/known-bad.mmd -o /tmp/known-bad.png"
  log_info "  Diagonal layout, three parallel stores in a row reading as a chain, six edges bundled on one node"
  log_info "Manual leg: whether an inspected render actually got corrected cannot be asserted here"
}
