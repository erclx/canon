#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "resolved" "missing"

  case "$SELECTED_OPTION" in
  "resolved")
    mkdir -p demos
    ffmpeg -y -f lavfi -i "testsrc=size=64x64:rate=1:duration=3" -c:v libvpx demos/cold-open.webm >/dev/null 2>&1

    git add . && git commit -m "feat(demo): seed a three-second recording to read back" --no-verify -q

    log_step "Scenario ready: read a recording's frames (read-frames)"
    log_info "Context: demos/cold-open.webm, a three-second synthetic clip staged for provisioning, no compiled plan beside it"
    log_info "Before:  ffmpeg on PATH, since provisioning shells to it directly to synthesize the fixture clip"
    log_info "Action:  /canon:read-frames demos/cold-open.webm"
    log_info "Expect:  canon demo frames extracts one PNG a second, three frames from the three-second clip"
    log_info "Expect:  the report reads every frame with the Read tool and describes each in a numbered list"
    log_info "Expect:  no pass-fail line, no looks-correct or looks-broken judgment, anywhere in the report"
    ;;
  "missing")
    log_step "Scenario ready: refuse a recording that is not there (read-frames)"
    log_info "Context: empty tree, no demos/ directory and no video anywhere"
    log_info "Action:  /canon:read-frames demos/cold-open.webm"
    log_info "Expect:  canon demo frames refuses with reason video-missing, the session reports that and stops"
    log_info "Expect:  no ffmpeg invocation, and no guess at what the recording would have shown"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
