#!/usr/bin/env bash
set -e
set -o pipefail

# A recorded take with its timeline beside it and a wrap section asking for an
# intro and a music bed, so a correct composition has a click and a fill to
# zoom on, captions to place against real target boxes, and a bed level to
# pick. No recording is staged, so the arm judges the composition source and
# never renders.
use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  stage_fixtures claude video-craft compose 01-initial

  git add . && git commit -m "feat(demo): cold-open draft, plan, and take timeline" --no-verify -q

  log_step "Scenario ready: compose a take into a designed video (video-craft)"
  log_info "Context: demos/cold-open/beats.md asks for an intro and a music bed, and"
  log_info "         demos/cold-open/take/cold-open.timeline.json carries a fill and a"
  log_info "         click with their target boxes. The webm itself is not staged."
  log_info "Action:  /canon:video-craft Compose demos/cold-open/take/cold-open.webm into"
  log_info "         demos/cold-open/index.html with the captions and zooms the beats"
  log_info "         name. Write the composition only and do not render."
  log_info "Expect:  declared in fixtures/claude/video-craft/expect.toml"
  log_info "         Check it with: canon sandbox check claude:video-craft"
  log_info ""
  log_info "The craft judgments sit under manual, read against the timeline's"
  log_info "entries rather than the plan's holds."
}
