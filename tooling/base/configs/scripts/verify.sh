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

check_markdown_bans() {
  if ! command -v canon >/dev/null 2>&1; then
    log_info "Skipped: no canon binary on PATH. Install with \`bun install --global @erclx/canon\`."
    return 0
  fi

  local files=()
  while IFS= read -r file; do
    files+=("$file")
  done < <(git ls-files --cached --others --exclude-standard -- '*.md' ':(exclude)CHANGELOG.md' ':(exclude)**/CHANGELOG.md')

  if [ ${#files[@]} -eq 0 ]; then
    log_info "No markdown file to check outside the exclusion set."
    return 0
  fi

  local output code
  if output=$(canon markdown audit "${files[@]}" 2>&1); then
    code=0
  else
    code=$?
  fi

  case "$code" in
  0)
    log_info "No banned character"
    ;;
  1)
    log_info "Skipped: canon markdown audit refused and measured nothing."
    ;;
  2)
    echo "$output" | pipe_output
    log_error "Markdown prose carries a banned character, or a relative link resolves to nothing on disk"
    ;;
  3)
    echo "$output" | pipe_output
    log_error "The markdown audit shipped an empty ban set, so the corpus was walked and nothing was looked for"
    ;;
  *)
    log_error "canon markdown audit exited $code, which is neither a pass nor a finding"
    ;;
  esac
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

  echo -e "${GREY}├${NC} ${WHITE}Formatting${NC}"
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

  log_step "Markdown bans"
  check_markdown_bans

  if [ "$NESTED" = false ]; then
    echo -e "${GREY}└${NC}\n"
    echo -e "${GREEN}✓ Verification passed${NC}"
  fi
}

main "$@"
