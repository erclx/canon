#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  # Staleness seed in canon/context/api.md. Every path this entry names resolved
  # when it was written and two of them no longer do, which is the axis no verb
  # answers. The count in the Layout lead-in is the second testable claim shape.
  #
  # Length seed in docs/overview.md. One paragraph past the sentence and
  # character checkpoints, and one top-level bullet carrying a paragraph's worth
  # of text behind a dash.
  stage_fixtures claude document-health shared 01-initial

  git add . && git commit -m "docs(project): initial project scaffold" --no-verify -q

  log_step "Scenario ready: document health across three axes"
  log_info "Context: a project whose documents have rotted in three different ways:"
  log_info "  1. canon/context/api.md names src/api/serialize.ts and src/api/errors.ts, neither of which exists"
  log_info "  2. canon/context/api.md states 'Three files carry the domain' against a tree holding one"
  log_info "  3. canon/context/api.md names 'canon api verify --strict', a command that does not exist"
  log_info "  4. docs/overview.md carries a paragraph past the sentence and character checkpoints"
  log_info "  5. docs/overview.md carries a top-level bullet past the character checkpoint"
  log_info "Action:  /document-health"
  log_info "Expect:  one section per document across length, placement, and staleness."
  log_info "         Length findings on docs/overview.md read as 'measured', citing the checkpoint"
  log_info "         the markdown audit record returned rather than a number from the skill body."
  log_info "         Every staleness finding on canon/context/api.md is marked 'read', not measured."
  log_info "         No verdict across the three axes and no score across the documents."
  log_info "         Nothing is repaired: both files are byte-identical after the run."
}
