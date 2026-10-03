#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  stage_fixtures claude ux-walkthrough shared 01-initial

  git add . && git commit -m "feat(notes): source-only tree with no build or server" --no-verify -q

  log_step "Scenario ready: refuse with nothing to measure (ux-walkthrough)"
  log_info "Context: package.json declares no build, dev, or preview script, and CLAUDE.md's Commands section holds only the seed placeholder"
  log_info "Action:  /canon:ux-walkthrough"
  log_info "Expect:  the skill refuses with 'Nothing to inspect. A walkthrough measures a running build.' and stops"
  log_info "Expect:  no file under .canon/walkthroughs/, no candidate page, and no server started"
  log_info "Manual:  the link-before-question order, the batch relay, and measurement read-back need a live operator, a browser, and a served build, so a headless run can only prove the refusal above"
}
