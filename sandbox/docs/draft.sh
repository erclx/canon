#!/usr/bin/env bash
set -e

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "fits-category" "fits-none" "already-covered"

  stage_fixtures docs draft shared catalog

  git add . && git commit -m "docs(agents): seed a populated governance catalog" -q

  case "$SELECTED_OPTION" in
  "fits-category")
    log_step "Scenario ready: page fits an existing category"
    log_info "Context: docs/agents/governance.md sits on the Governance shelf"
    log_info "Action:  /canon:draft-docs add a page documenting the gov audit command"
    log_info "Expect:  drafted at docs/agents/<slug>.md, category: Governance, confirmed before write"
    ;;

  "fits-none")
    log_step "Scenario ready: page fits no existing category"
    log_info "Context: no catalog shelf covers a brand-new domain"
    log_info "Action:  /canon:draft-docs add a page documenting the new capture pipeline"
    log_info "Expect:  drafted at docs/<slug>.md, at the flat root, confirmed before write"
    ;;

  "already-covered")
    log_step "Scenario ready: topic already has a page"
    log_info "Context: docs/agents/governance.md already documents the gov CLI"
    log_info "Action:  /canon:draft-docs add a page for the governance CLI"
    log_info "Expect:  refuses toward /canon:docs-sync, since docs/agents/governance.md already covers it"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
