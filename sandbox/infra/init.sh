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
  "name": "sandbox-init-infra",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  mkdir -p scripts
  cat <<'SCRIPT' >scripts/placeholder.sh
#!/bin/bash
echo "placeholder"
SCRIPT
  chmod +x scripts/placeholder.sh

  git add .
  git commit -m "chore(sandbox): scaffold init infra test directory" --no-verify -q

  log_step "Init sandbox"
  log_info "default     : interactive full init (prompts for optional domains)"
  log_info "with-flags  : non-interactive init with --stack, --skip"

  select_or_route_scenario "Which scenario?" "default" "with-flags"

  case "$SELECTED_OPTION" in
  "default")
    log_step "Running: canon init ."
    exec bun "$PROJECT_ROOT/src/cli.ts" init .
    ;;
  "with-flags")
    log_step "Running: canon init --stack base --skip wiki ."
    export CANON_NON_INTERACTIVE=1
    exec bun "$PROJECT_ROOT/src/cli.ts" init --stack base --skip wiki .
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
