#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  stage_fixtures claude markdown-propose shared 01-initial

  git add . && git commit -m "docs: add overview and limitations pages" --no-verify -q

  log_step "Scenario ready: one inflated claim corrects, one has to be drafted"
  log_info "Context: CLAUDE.md and docs/overview.md's description field both"
  log_info "  carry the same inflated framework claim, corrected by"
  log_info "  docs/limitations.md, which already states the true scope."
  log_info "  docs/overview.md's tagline carries a second inflated claim that"
  log_info "  cannot be deleted and has no source anywhere in the tree, so"
  log_info "  its replacement has to be invented."
  log_info ""
  log_info "Action:  /canon:markdown-propose screen CLAUDE.md and"
  log_info "         docs/overview.md for inflated claims and propose fixes,"
  log_info "         as the inflated-claims proposal"
  log_info "Expect:  declared in fixtures/claude/markdown-propose/expect.toml"
  log_info "         Check it with: canon sandbox check claude:markdown-propose"
  log_info "         A folder at .canon/proposals/<slug>/ carrying a corrected"
  log_info "         single-replacement change in each file and one drafted"
  log_info "         change with three labelled variants, every You: slot empty."
  log_info "         Three expectations need a reader and report as unchecked."
}
