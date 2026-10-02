#!/usr/bin/env bash
set -e
set -o pipefail

stage_setup() {
  if ! command -v go >/dev/null 2>&1; then
    log_error "go is not installed. Install from https://go.dev/dl/"
  fi
  if ! command -v golangci-lint >/dev/null 2>&1; then
    log_error "golangci-lint is not installed. Run 'go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest'"
  fi

  log_step "Scaffolding go (go mod init)"
  go mod init example.com/sandbox-go >/dev/null 2>&1
  go mod edit -ignore=./node_modules
  log_info "go mod init complete, node_modules ignored"

  log_step "Seeding package.json (bun init -y)"
  bun init -y >/dev/null 2>&1
  log_info "package.json created"

  log_step "Applying go stack (base + go via extends)"
  bun "$PROJECT_ROOT/src/cli.ts" tooling inject go . --nested

  log_step "Initializing Husky"
  bunx husky

  log_step "Setting script permissions"
  chmod +x scripts/*.sh
  log_info "Scripts made executable"

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

  log_step "Scenario ready: go tooling test"
  log_info "Context: golden configs from tooling/base + tooling/go applied"
  log_info "Action:  inspect configs, run 'bun run check' to verify"
}
