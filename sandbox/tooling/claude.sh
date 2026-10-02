#!/usr/bin/env bash
set -e
set -o pipefail

stage_setup() {
  log_step "Initializing package"
  cat <<'EOF' >package.json
{
  "name": "sandbox-claude-workflow",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF
  log_info "package.json created"

  cat <<'EOF' >.gitignore
node_modules/
EOF
  log_info ".gitignore created"

  log_step "Injecting governance rules"
  bun "$PROJECT_ROOT/src/cli.ts" gov install base "."
  log_info "Base rules injected into .claude/rules/"

  log_step "Scenario ready: Claude workflow"
  log_info "Context: Empty project with base gov rules injected"
  log_info ""
  log_info "Test sequence:"
  log_info "  1. canon claude init        : seed .claude/ and verify DESIGN.md prompt"
  log_info "  2. canon claude sync        : verify .gitignore reconciles against the manifest"
  log_info ""
  log_info "Verify after init:"
  log_info "  .canon/tasks/index.md, REQUIREMENTS.md, ARCHITECTURE.md exist"
  log_info "  canon/wireframes/index.md exists"
  log_info "  canon/DESIGN.md exists only if UI was selected"
  log_info "  .gitignore contains .canon/tmp/"
}
