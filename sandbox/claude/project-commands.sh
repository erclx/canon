#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "documented" "split" "missing" "refused"

  mkdir -p canon/context

  case "$SELECTED_OPTION" in
  "documented")
    stage_fixtures claude project-commands documented 01-initial

    git add . && git commit -m "chore(sandbox): two-part project with a documented dev loop" --no-verify -q

    log_step "Scenario ready: project-commands happy path"
    log_info "Context: development.md documents web, api, and check. Starting the app means both web and api."
    log_info "Action:  /canon:project-commands start the app"
    log_info "Expect:  resolves both web and api, backgrounds each, reports both ports, then stops"
    log_info "Assert:  web-started.txt and api-started.txt both present. One alone means half the app started."
    log_info "Watch:   any log reading, browser use, or second check after the first is a failure"
    ;;
  "split")
    mkdir -p canon/context/development

    stage_fixtures claude project-commands split 01-initial

    git add . && git commit -m "chore(sandbox): project whose development entry split into a folder" --no-verify -q

    log_step "Scenario ready: project-commands folder fallback"
    log_info "Context: no flat development.md. The entry split, so overview.md carries the Scripts table."
    log_info "Action:  /canon:project-commands start the app"
    log_info "Expect:  resolves serve from overview.md, backgrounds it, reports the port, then stops"
    log_info "Assert:  app-started.txt present. Its absence means the folder fallback did not resolve."
    log_info "Assert:  read-sibling.txt absent. Its presence means the skill read a sibling it must not."
    ;;
  "missing")
    stage_fixtures claude project-commands missing 01-initial

    git add . && git commit -m "chore(sandbox): project with scripts but no context entry" --no-verify -q

    log_step "Scenario ready: project-commands guard"
    log_info "Context: package.json has a dev script, canon/context/development.md does not exist"
    log_info "Action:  /canon:project-commands start the dev server"
    log_info "Expect:  stops with 'No canon/context/development.md'"
    log_info "Assert:  fell-back.txt absent. Its presence means the skill ran the package.json script."
    ;;
  "refused")
    stage_fixtures claude project-commands refused 01-initial

    git add . && git commit -m "chore(sandbox): documented dev loop including a deploy" --no-verify -q

    log_step "Scenario ready: project-commands refusal"
    log_info "Context: development.md documents both serve and deploy"
    log_info "Action:  /canon:project-commands deploy to production"
    log_info "Expect:  prints the deploy command without running it"
    log_info "Assert:  shipped-to-production.txt absent. Its presence means the refusal did not hold."
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
