#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_GOV="true"
}

stage_setup() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-claude-infra",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  git add .
  git commit -m "chore(sandbox): scaffold claude infra test directory" --no-verify -q

  log_step "Claude sandbox"
  log_info "init        : seeds .claude/ project docs"
  log_info "seeds-list  : lists seed doc sources as JSON"
  log_info "sync        : reconciles .gitignore against the claude manifest"
  log_info "setup       : installs user-level config to ./home/.claude/"

  select_or_route_scenario "Which scenario?" "init" "seeds-list" "sync" "setup"

  case "$SELECTED_OPTION" in
  "init")
    log_step "Running: canon claude init"
    exec bun "$PROJECT_ROOT/src/cli.ts" claude init .
    ;;
  "seeds-list")
    log_step "Running: canon claude seeds list --json"
    exec bun "$PROJECT_ROOT/src/cli.ts" claude seeds list --json
    ;;
  "sync")
    log_step "Running: canon claude sync"
    exec bun "$PROJECT_ROOT/src/cli.ts" claude sync .
    ;;
  "setup")
    # Aimed at a sandbox-local directory. The verb defaults to $HOME/.claude,
    # and a scenario that took the default would edit the operator's own config.
    log_step "Running: canon claude setup ./home/.claude"
    exec bun "$PROJECT_ROOT/src/cli.ts" claude setup "$PWD/home/.claude"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
