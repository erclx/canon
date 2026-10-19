#!/usr/bin/env bash
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

source "$PROJECT_ROOT/scripts/lib/ui.sh"

ZSHRC="${ZDOTDIR:-$HOME}/.zshrc"
MARKER_OPEN="# >>> canon aliases >>>"
MARKER_CLOSE="# <<< canon aliases <<<"

check_dependencies() {
  command -v bun >/dev/null 2>&1 || log_error "bun is not installed. See https://bun.sh, then re-run."
}

install_cli() {
  log_step "Installing the canon CLI"
  bun install --cwd "$PROJECT_ROOT" >/dev/null
  bun link --cwd "$PROJECT_ROOT" >/dev/null
  log_info "Dependencies installed and canon linked"
}

alias_block() {
  cat <<EOF
$MARKER_OPEN
TOOLKIT="$PROJECT_ROOT"
export CLAUDE_CODE_ENABLE_TODO_TOOLS=1

alias cl='claude'
alias clr='cl -r'
alias clc='cl -c'
alias clw='cl -w'
alias cls='cl --model sonnet'

alias clp='claude --plugin-dir \$TOOLKIT/claude'
alias clpc='clp -c'
alias clps='clp --model sonnet'
alias clpa='clp agents'
alias clpac='clpa --cwd .'
$MARKER_CLOSE
EOF
}

install_aliases() {
  log_step "Installing Claude Code shell aliases"
  log_info "This step manages a marked alias block in $ZSHRC, the only file outside the repo this script writes."
  log_info "Delete the block and its two marker comments to remove the aliases. Re-running never adds a second copy."

  if [ -f "$ZSHRC" ] && grep -qF "$MARKER_OPEN" "$ZSHRC"; then
    log_info "Aliases already present in $ZSHRC, skipping"
    return
  fi

  if [ -f "$ZSHRC" ] && grep -qE "^alias clp=" "$ZSHRC"; then
    log_warn "An unmanaged clp alias is already in $ZSHRC. Leaving it untouched."
    log_warn "Remove it and re-run to switch to the managed block."
    return
  fi

  printf '\n%s\n' "$(alias_block)" >>"$ZSHRC"
  log_add "Appended canon alias block to $ZSHRC"
  log_info "Run 'source $ZSHRC' or open a new shell to load them"
}

verify_cli() {
  log_step "Verifying the install"
  if canon --help >/dev/null 2>&1; then
    log_info "canon resolves on PATH"
  else
    log_warn "canon not on PATH yet. Ensure \$BUN_INSTALL/bin is exported, then re-open your shell."
  fi
}

main() {
  open_timeline "canon bootstrap"
  trap close_timeline EXIT

  check_dependencies
  install_cli
  install_aliases
  verify_cli
}

main "$@"
