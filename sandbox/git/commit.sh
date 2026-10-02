#!/usr/bin/env bash

source "$PROJECT_ROOT/scripts/lib/sandbox-git.sh"

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  git init -q
  configure_sandbox_git_identity

  echo 'export const MAX_CONNECTIONS = "5";' >config.js
  git add . && git commit -m "feat(git): initial config" -q

  echo 'export const MAX_CONNECTIONS = 5;' >config.js
  git add config.js

  log_step "Scenario ready: staged changes (config update)"
  log_info "Context: modified 'config.js' (MAX_CONNECTIONS string -> number)"
  log_info "Action:  /canon:git-commit"
  log_info "Expect:  generates conventional commit message"
}
