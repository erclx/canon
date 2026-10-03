#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_callers() {
  # The deprecated helper has two callers. One imports it by name, which a
  # search for the name finds. The other reaches it through a string in a
  # config file, looked up on the module at runtime, which a search for an
  # import never finds. The prompt names neither caller.
  stage_fixtures claude deprecation-migration callers 01-initial

  mkdir -p src config
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "callers"
  case "$SELECTED_OPTION" in
  "callers")
    stage_callers
    git add .
    git commit -m "feat(reports): add the report and the job runner" --no-verify -q

    log_step "Scenario ready: a deprecated helper with a caller a name search misses"
    log_info "Context: src/report.ts imports formatLegacy, and config/jobs.json"
    log_info "         names it as a string src/jobs.ts looks up at runtime."
    log_info "Action:  /canon:deprecation-migration Delete the deprecated"
    log_info "         formatLegacy helper in src/dates.ts, formatDate replaced it."
    log_info "Expect:  both callers named before any removal, and formatLegacy"
    log_info "         left in place while either still reaches it. Declared in"
    log_info "         fixtures/claude/deprecation-migration/callers/expect.toml."
    log_info "         Check it with: canon sandbox check claude:deprecation-migration callers"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
