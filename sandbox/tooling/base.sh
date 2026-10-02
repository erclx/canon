#!/usr/bin/env bash
set -e
set -o pipefail

stage_setup() {
  log_step "Initializing package"
  cat <<'EOF' >package.json
{
  "name": "sandbox-base-tooling",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF
  log_info "package.json created"

  bun "$PROJECT_ROOT/src/cli.ts" tooling inject base . --nested

  log_step "Initializing Husky"
  bunx husky

  log_step "Setting script permissions"
  chmod +x scripts/*.sh
  log_info "Scripts made executable"

  log_step "Running verification"
  if bash scripts/verify.sh; then
    log_info "All checks passed"
  else
    log_warn "Verification failed, check configs"
  fi

  log_step "Scenario ready: base tooling test"
  log_info "Context: golden configs from tooling/base applied"
  log_info "Action:  inspect configs, run 'bun run check' to verify"
}
