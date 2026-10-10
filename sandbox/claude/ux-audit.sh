#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  stage_fixtures claude ux-audit shared 01-initial

  mkdir -p .claude
  git add . && git commit -m "feat(ui): initial task list and add modal" --no-verify -q

  log_step "Scenario ready: UX audit with seeded drift"
  log_info "Context: small Vite/React app with DESIGN.md and components that drift on purpose"
  log_info "Seeded drift to look for in the audit:"
  log_info "  Button.tsx adds a third variant 'ghost' not in DESIGN.md"
  log_info "  Button.css uses raw 12px/18px instead of --space tokens"
  log_info "  TaskList.tsx mixes Lucide and MUI icons (DESIGN.md says Lucide only)"
  log_info "  TaskList.tsx uses inline px styles instead of tokens"
  log_info "  TaskList.tsx renders nothing while loading (no skeleton state in DESIGN.md)"
  log_info "  TaskList.tsx has no empty state (DESIGN.md describes one)"
  log_info "  TaskList.tsx has no error state"
  log_info "  AddTaskModal.tsx has two primary buttons. Cancel should be secondary"
  log_info "Action:  /ux-audit"
  log_info "Expect:  observations grouped by surface, written to .canon/review/ux-audit-<slug>.md"
}
