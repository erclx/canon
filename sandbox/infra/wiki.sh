#!/usr/bin/env bash
set -e
set -o pipefail

seed_legacy_wiki() {
  mkdir -p wiki
  cat <<'EOF' >wiki/setup.md
# Setup

Page authored before the wiki moved under .claude/.
EOF
}

stage_setup() {
  log_step "Wiki sandbox"
  log_info "init   : scaffolds .claude/wiki/ folder with stub index.md"
  log_info "legacy : reports a root wiki/ instead of migrating it"

  select_or_route_scenario "Which scenario?" "init" "legacy"

  case "$SELECTED_OPTION" in
  "init")
    log_step "Running: canon wiki init"
    bun "$PROJECT_ROOT/src/cli.ts" wiki init .
    log_info "Assert:  canon sandbox check infra:wiki init"
    ;;
  "legacy")
    seed_legacy_wiki
    log_step "Seeded a root wiki/ with an authored page"
    log_step "Running: canon wiki init"
    bun "$PROJECT_ROOT/src/cli.ts" wiki init .
    log_info "Expect:  wiki/setup.md still present, .claude/wiki/index.md added"
    log_info "Assert:  canon sandbox check infra:wiki legacy"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
