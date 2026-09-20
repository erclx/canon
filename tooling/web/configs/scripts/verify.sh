#!/bin/bash
set -e
set -o pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
WHITE='\033[1;37m'
GREY='\033[0;90m'
NC='\033[0m'

NESTED="${VERIFY_NESTED:-false}"

log_info() { echo -e "${GREY}│${NC} ${GREEN}✓${NC} $1"; }
log_error() {
  echo -e "${GREY}│${NC} ${RED}✗${NC} $1"
  exit 1
}
log_step() { echo -e "${GREY}│${NC}\n${GREY}├${NC} ${WHITE}$1${NC}"; }

pipe_output() { while IFS= read -r line; do echo -e "${GREY}│${NC}  $line"; done; }

check_dependencies() {
  command -v bun >/dev/null 2>&1 || log_error "bun is not installed"
}

run_check() {
  local cmd=$1
  local err_msg=$2
  local output
  if ! output=$(eval "$cmd" 2>&1); then
    echo "$output" | pipe_output
    log_error "$err_msg"
  fi
  echo "$output" | pipe_output
}

main() {
  check_dependencies

  if [ "$NESTED" = false ]; then echo -e "${GREY}┌${NC}"; fi

  echo -e "${GREY}├${NC} ${WHITE}Typecheck${NC}"
  run_check "bun run typecheck" "Typecheck failed"
  log_info "Typecheck passed"

  log_step "Lint"
  run_check "bun run lint" "Lint failed"
  log_info "Lint passed"

  log_step "Formatting"
  run_check "bun run format" "Format failed"
  log_info "Format applied"

  log_step "Format check"
  run_check "bun run check:format" "Format check failed"
  log_info "Format check passed"

  log_step "Spelling"
  run_check "bun run check:spell" "Spell check failed"
  log_info "Spell check passed"

  log_step "Shell"
  run_check "bun run check:shell" "Shell check failed"
  log_info "Shell check passed"

  log_step "Unit tests"
  run_check "bun run test:run" "Unit tests failed"
  log_info "Unit tests passed"

  log_step "Build"
  run_check "bun run build" "Build failed"
  log_info "Build passed"

  # Runs whenever the stack shipped a card exclusion check, which keeps the
  # stage stack-agnostic here and the check itself in the stack that owns the
  # card route's shape. It reads the build above, so it sits after it.
  if [ -f scripts/check-card-exclusion.sh ]; then
    log_step "Card exclusion"
    run_check "bash scripts/check-card-exclusion.sh" "Card exclusion check failed"
    log_info "Card exclusion passed"
  fi

  if [ "$NESTED" = false ]; then
    echo -e "${GREY}└${NC}\n"
    echo -e "${GREEN}✓ Verification passed${NC}"
  fi
}

main "$@"
