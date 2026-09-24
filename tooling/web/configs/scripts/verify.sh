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
log_skip() { echo -e "${GREY}│ - $1${NC}"; }

pipe_output() { while IFS= read -r line; do echo -e "${GREY}│${NC}  $line"; done; }

check_dependencies() {
  command -v bun >/dev/null 2>&1 || log_error "bun is not installed"
}

check_package() {
  [ -f package.json ] || log_error "No package.json here. Run 'bun init', then sync the stack again"
}

has_script() {
  bun -e 'process.exit(require(process.cwd() + "/package.json").scripts?.[process.argv[1]] ? 0 : 1)' "$1"
}

# A subfolder synced with --skip base declares none of base's scripts, since
# the repository root owns them. Each base phase runs only where its script is
# declared, so this script passes on its own in that subfolder.
run_base_phase() {
  local title=$1
  local script=$2
  local err_msg=$3
  local pass_msg=$4

  log_step "$title"
  if ! has_script "$script"; then
    log_skip "Skipped: $script is not declared here, so the repository root runs it"
    return
  fi
  run_check "bun run $script" "$err_msg"
  log_info "$pass_msg"
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
  check_package

  if [ "$NESTED" = false ]; then echo -e "${GREY}┌${NC}"; fi

  echo -e "${GREY}├${NC} ${WHITE}Typecheck${NC}"
  run_check "bun run typecheck" "Typecheck failed"
  log_info "Typecheck passed"

  log_step "Lint"
  run_check "bun run lint" "Lint failed"
  log_info "Lint passed"

  run_base_phase "Formatting" "format" "Format failed" "Format applied"
  run_base_phase "Format check" "check:format" "Format check failed" "Format check passed"
  run_base_phase "Spelling" "check:spell" "Spell check failed" "Spell check passed"
  run_base_phase "Shell" "check:shell" "Shell check failed" "Shell check passed"

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
