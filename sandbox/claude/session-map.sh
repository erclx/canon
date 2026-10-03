#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  stage_fixtures claude session-map shared 01-initial

  git add . && git commit -m "feat(api): scaffold the task API and its board" --no-verify -q

  git checkout -b feat/csv-export -q

  # Left untracked on purpose. `## State` owes the reader any untracked file that
  # needs committing, so a map filled from boilerplate rather than from a read of
  # the tree is separable from one filled correctly.
  stage_fixtures claude session-map shared 02-untracked

  log_step "Scenario ready: a cold session on a feature branch with a board to report on"
  log_info "Context: the branch is feat/csv-export, so the slug drops the type and"
  log_info "  the map lands at .canon/tasks/session-csv-export.md"
  log_info "  The board carries v01.0 shipped and v02.0 and v03.0 open, and"
  log_info "  Every board row resolves to a plan, so a dangling link is never"
  log_info "  state a cold session has to report"
  log_info "  .canon/plans/feature-csv-export.md is the plan behind the branch"
  log_info "  src/routes/export.ts is untracked, which is what ## State owes a reader"
  log_info ""
  log_info "The project carries no claude/skills/ corpus, so the drift step's verb"
  log_info "refuses and the map records the refusal rather than a name. The only"
  log_info "commit is newer than any session window, so the elapsed-time ref"
  log_info "recovery returns empty and item 3 of the standard answers it."
  log_info ""
  log_info "Both defects this arm covers came out of cold headless runs recorded on"
  log_info "pull request #1097, which states their conditions rather than the"
  log_info "prompt each used. Those runs named no skill, to settle routing. This"
  log_info "arm names one, since routing is settled and the steps are not."
  log_info ""
  log_info "Action:  /canon:session-map"
  log_info "Expect:  declared in fixtures/claude/session-map/expect.toml"
  log_info "         Check it with: canon sandbox check claude:session-map"
  log_info "         A map carrying the three core sections, the drift verb's own"
  log_info "         refusal, and the untracked file. The board ends the run"
  log_info "         untouched."
  log_info "         What the map says about the empty window is a reader"
  log_info "         expectation, since item 3 fixes what a writer must say and"
  log_info "         not the words to say it in."
  log_info "         Five expectations need a reader and report as unchecked."
}
