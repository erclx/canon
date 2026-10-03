#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  # The pre-split surface is `.claude/DIAGRAMS.md`. Three kinds in one file, which
  # is the shape every project installed before the folder still carries.
  stage_fixtures claude diagram-migrate shared 01-initial

  mkdir -p fixtures

  # Baseline for the leave-the-original-alone assertion. A conversion that
  # edits or deletes its own source removes the only way to check the split.
  sha256sum .claude/DIAGRAMS.md >fixtures/original.sha256

  git add . && git commit -m "feat(sandbox): seed a project holding the pre-split flat diagram file" --no-verify -q

  log_step "Scenario ready: convert a pre-split .claude/DIAGRAMS.md into per-kind entries"
  log_info "Context: three H2 sections in one flat file, seeded .canon/diagrams/ holding index.md alone"
  log_info "Signals the skill should pick up:"
  log_info "  .canon/diagrams/ has no entries and .claude/DIAGRAMS.md exists → this is a migration pass"
  log_info "  Three H2 sections map to components, request flow, and deployment"
  log_info "  No section maps to system context, so that kind stays absent this pass"
  log_info "Action: /canon:draft-diagram"
  log_info "Expect: three entries under .canon/diagrams/, one per H2 section"
  log_info "  Named by the standard: components.md, request-flow.md, deployment.md"
  log_info "Expect: each mermaid body carried across unchanged, not redrawn"
  log_info "  Assert it: diff <(grep -A 20 'flowchart TB' .claude/DIAGRAMS.md) is a manual read, compare bodies by eye"
  log_info "Expect: .claude/DIAGRAMS.md untouched on disk"
  log_info "  Assert it: sha256sum -c fixtures/original.sha256"
  log_info "Expect: chat output says deleting the original is the user's call"
  log_info "Expect: .canon/diagrams/index.md regenerated, three entries under category headings"
  log_info "Failure to catch: a pass that redraws rather than converts, which hides whether the move or the rewrite broke a diagram"
  log_info "Manual leg: whether each section landed in the kind it actually belongs to"
}
