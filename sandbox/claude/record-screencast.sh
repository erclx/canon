#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "resolved" "refused"

  case "$SELECTED_OPTION" in
  "resolved")
    stage_fixtures claude record-screencast resolved 01-initial

    git add . && git commit -m "feat(demo): cold-open draft and a resolved plan" --no-verify -q

    log_step "Scenario ready: run a resolved plan (record-screencast)"
    log_info "Context: demos/cold-open/beats.md paired with demos/cold-open/plan.json, already compiled and fully filled"
    log_info "Before:  bun install, then bunx playwright install chromium. Neither is seeded, since a sandbox provisions files and cannot fetch a browser."
    log_info "Before:  serve board.html on port 4173, e.g. python3 -m http.server 4173, since the plan's url points there"
    log_info "Action:  /canon:record-screencast demos/cold-open/beats.md"
    log_info "Expect:  demos/cold-open/plan.json already exists, so the session skips canon demo compile entirely and never touches the plan"
    log_info "Expect:  canon demo run drives the page and reports the webm, the mp4 if ffmpeg is on PATH, the still, and the timeline, each on its own line"
    ;;
  "refused")
    stage_fixtures claude record-screencast refused 01-initial

    git add . && git commit -m "feat(demo): empty-state-tour draft and a plan missing its url" --no-verify -q

    log_step "Scenario ready: refuse an unresolved plan (record-screencast)"
    log_info "Context: demos/empty-state-tour/beats.md paired with demos/empty-state-tour/plan.json, already compiled but url is still empty"
    log_info "Action:  /canon:record-screencast demos/empty-state-tour/beats.md"
    log_info "Expect:  demos/empty-state-tour/plan.json already exists, so the session skips canon demo compile and calls canon demo run directly"
    log_info "Expect:  the run refuses with reason plan-unresolved, the session reports url as the missing field, and it stops"
    log_info "Expect:  no browser launch, no guessed url, and no edit to demos/empty-state-tour/plan.json"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
