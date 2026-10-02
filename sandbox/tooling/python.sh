#!/usr/bin/env bash
set -e
set -o pipefail

stage_setup() {
  if ! command -v uv >/dev/null 2>&1; then
    log_error "uv is not installed. Install from https://docs.astral.sh/uv/"
  fi

  log_step "Scaffolding python (uv init --package)"
  uv init --package --name sandbox-python --no-readme . >/dev/null
  log_info "uv init complete"

  log_step "Seeding package.json (bun init -y)"
  bun init -y >/dev/null 2>&1
  log_info "package.json created"

  log_step "Applying python stack (base + python via extends)"
  bun "$PROJECT_ROOT/src/cli.ts" tooling inject python . --nested

  log_step "Initializing Husky"
  bunx husky

  log_step "Setting script permissions"
  chmod +x scripts/*.sh
  log_info "Scripts made executable"

  log_step "Installing python tooling deps"
  log_info "Manifest does not declare these because inject hardcodes 'bun add -D'"
  uv add --dev ruff mypy pytest pytest-cov >/dev/null 2>&1
  log_info "ruff, mypy, pytest, pytest-cov added"

  log_step "Syncing python venv"
  uv sync >/dev/null 2>&1
  log_info "uv sync complete"

  log_step "Running lint:fix"
  if bun run lint:fix >/dev/null 2>&1; then
    log_info "Auto-fix applied"
  else
    log_warn "lint:fix had issues"
  fi

  log_step "Running verification"
  if bash scripts/verify.sh; then
    log_info "All checks passed"
  else
    log_warn "Verification failed, check configs"
  fi

  log_step "Scenario ready: python tooling test"
  log_info "Context: golden configs from tooling/base + tooling/python applied"
  log_info "Action:  inspect configs, run 'bun run check' to verify"
}
