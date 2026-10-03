#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_rename() {
  # The exported function hands back the stored row, so its storage column
  # names are already part of what a caller sees. The command copies one of
  # them, `buyer`, straight into its JSON, and the nightly script parses it.
  # A rename in place breaks that script, which the prompt never mentions.
  stage_fixtures claude api-design rename 01-initial

  mkdir -p src scripts
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "rename"
  case "$SELECTED_OPTION" in
  "rename")
    stage_rename
    git add .
    git commit -m "feat(orders): add the show command" --no-verify -q

    log_step "Scenario ready: a command whose JSON a script outside it parses"
    log_info "Context: src/cli.ts prints { id, buyer, total }, and"
    log_info "         scripts/nightly-report.sh reads .buyer out of it with jq."
    log_info "Action:  /canon:api-design Rename the buyer field in the JSON that"
    log_info "         orders show prints to customerId."
    log_info "Expect:  customerId added beside buyer rather than replacing it, and"
    log_info "         the nightly script left reading .buyer. Declared in"
    log_info "         fixtures/claude/api-design/rename/expect.toml."
    log_info "         Check it with: canon sandbox check claude:api-design rename"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
