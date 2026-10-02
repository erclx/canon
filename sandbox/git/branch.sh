#!/usr/bin/env bash
set -e

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  # All six are declared to scope what `set_palette` assigns, so the names this
  # file never spells stay out of the globals a sourcing script reads.
  # shellcheck disable=SC2034
  local GREEN RED YELLOW WHITE GREY NC
  set_palette 2
  echo "Base project" >README.md
  git add .
  git commit -m "chore(project): init base" -q

  git checkout -b feat/clean-feature -q
  echo "valid code" >feature.js
  git add . && git commit -m "feat(core): compliant feature work" -q

  git checkout -b temp/wip-stuff -q
  echo "messy code" >wip.js
  git add . && git commit -m "feat(wip): messy work in progress" -q

  log_step "Scenario ready: branch naming compliance"

  log_info "Test A (current branch): 'temp/wip-stuff'"
  log_info "  Action: /canon:git-branch"
  log_info "  Expect: Suggest rename to 'feat/wip-messy-work'"

  echo -e "${GREY}│${NC}" >&2

  log_info "Test B (toggle): 'git checkout feat/clean-feature'"
  log_info "  Action: /canon:git-branch"
  log_info "  Expect: '✅ Branch name already follows conventions'"
}
