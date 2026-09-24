#!/usr/bin/env bash
set -e
set -o pipefail

stage_setup() {
  if ! command -v php >/dev/null 2>&1; then
    log_error "php is not installed. Install PHP 8.3 or later"
  fi
  if ! command -v composer >/dev/null 2>&1; then
    log_error "composer is not installed. Install from https://getcomposer.org/"
  fi

  log_step "Scaffolding php (composer init)"
  composer init -n --name example/sandbox-php --autoload src/ >/dev/null 2>&1
  log_info "composer init complete"

  log_step "Seeding package.json (bun init -y)"
  bun init -y >/dev/null 2>&1
  log_info "package.json created"

  log_step "Applying php stack (base + php via extends)"
  bun "$PROJECT_ROOT/src/cli.ts" tooling inject php . --nested

  log_step "Initializing Husky"
  bunx husky

  log_step "Setting script permissions"
  chmod +x scripts/*.sh
  log_info "Scripts made executable"

  log_step "Installing php tooling deps"
  log_info "Manifest does not declare these because inject hardcodes 'bun add -D'"
  composer require --dev friendsofphp/php-cs-fixer phpstan/phpstan phpunit/phpunit >/dev/null 2>&1
  log_info "php-cs-fixer, phpstan, phpunit added"

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

  log_step "Scenario ready: php tooling test"
  log_info "Context: golden configs from tooling/base + tooling/php applied"
  log_info "Action:  inspect configs, run 'bun run check' to verify"
}
