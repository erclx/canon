#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-git.sh"

use_anchor() {
  use_sandbox_anchor
}

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "without-changelog" "with-changelog"

  configure_sandbox_anchor_remote

  stage_fixtures git ship shared 01-init

  mkdir -p src
  echo 'export const PORT = 8080;' >src/server.js

  printf 'node_modules\n.canon/plans/\n.canon/review/\n.canon/memory/\n' >.gitignore

  git add . && git commit -m "chore(project): init" -q

  git push --force origin HEAD:main
  git push origin --delete draft/init -q 2>/dev/null || true

  git checkout -b draft/init -q

  stage_fixtures git ship shared 02-draft

  mkdir -p src/routes
  echo 'export function register(app) { app.get("/health", () => healthCheck()); }' >src/routes/health.js

  case "$SELECTED_OPTION" in
  "with-changelog")
    printf "# Changelog\n\n## [0.1.0]\n\n- Initial release\n" >CHANGELOG.md

    log_step "Scenario ready: with changelog"
    log_info "Context: draft/init branch, port changed to 3000, health check added, README stale, CHANGELOG.md present, one seeded memory entry"
    log_info "Action:  /git:ship"
    log_info "Expect:  the verify gate finds no command named and says so rather than stopping,"
    log_info "         then README updated, changes committed, branch renamed, PR opened, changelog appended"
    ;;
  "without-changelog")
    log_step "Scenario ready: without changelog"
    log_info "Context: draft/init branch, port changed to 3000, health check added, README stale, no CHANGELOG.md, one seeded memory entry"
    log_info "Action:  /git:ship"
    log_info "Expect:  the verify gate finds no command named and says so rather than stopping,"
    log_info "         then README updated, changes committed, branch renamed, PR opened, changelog step skipped"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
