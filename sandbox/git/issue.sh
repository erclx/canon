#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-git.sh"

use_anchor() {
  use_sandbox_anchor
}

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  log_step "Configuring issue environment ($ANCHOR_REPO)"

  configure_sandbox_anchor_remote
  git push --force origin HEAD:main

  stage_fixtures git issue shared 01-capitalize

  git add utils.js
  git commit -m "feat(utils): add capitalize helper" -q

  log_step "Scenario ready: file an issue"
  log_info "Context: a repo with a GitHub remote and a capitalize helper that crashes on an empty string"
  log_info "Action:  /canon:git-issue log a bug: capitalize throws on an empty string"
  log_info "Expect:  agent files a bug issue on the remote and prints the issue URL"
}
