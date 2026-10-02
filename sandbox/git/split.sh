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
  select_or_route_scenario "Which scenario?" "independent" "stacked"

  log_step "Configuring split environment ($ANCHOR_REPO)"

  configure_sandbox_anchor_remote
  git push --force origin HEAD:main

  case "$SELECTED_OPTION" in
  "independent")
    git push origin --delete feat/user-auth -q 2>/dev/null || true
    git checkout -b feat/user-auth -q

    mkdir -p src
    echo 'export function login(user) { return fetch("/api/login", { body: user }); }' >src/auth.js
    git add . && git commit -m "feat(auth): add login function" -q

    echo 'export function logout() { return fetch("/api/logout"); }' >>src/auth.js
    git add . && git commit -m "feat(auth): add logout function" -q

    mkdir -p scripts
    cat <<'EOF' >scripts/setup.sh
#!/bin/bash
echo "Setting up project..."
npm install
EOF
    git add . && git commit -m "chore(scripts): add project setup script" -q

    mkdir -p docs
    printf "# Auth module\n\nHandles login and logout.\n" >docs/auth.md
    git add . && git commit -m "docs(auth): add auth module reference" -q

    printf "# Contributing\n\nRun npm install before committing.\n" >docs/contributing.md
    git add . && git commit -m "docs(project): add contributing guide" -q

    echo 'export function register(user) { return fetch("/api/register", { body: user }); }' >>src/auth.js
    git add . && git commit -m "feat(auth): add register function" -q

    log_step "Scenario ready: 6 mixed independent commits on feat/user-auth"
    log_info "Context: 3 auth + 1 chore/scripts + 2 docs (no file overlap between groups)"
    log_info "Action:  /canon:git-split"
    log_info "Expect:  Independent mode. One branch per concern. PRs based on main"
    ;;
  "stacked")
    git push origin --delete feat/payments -q 2>/dev/null || true
    git checkout -b feat/payments -q

    mkdir -p src
    echo 'export function logger(msg) { console.log(msg); }' >src/logger.js
    git add . && git commit -m "feat(logger): add logger helper" -q

    echo 'export function charge(amount) { return fetch("/api/charge"); }' >src/payments.js
    git add . && git commit -m "feat(payments): add charge function" -q

    cat <<'EOF' >src/payments.js
import { logger } from "./logger.js";
export function charge(amount) {
  logger("charging " + amount);
  return fetch("/api/charge");
}
EOF
    git add . && git commit -m "refactor(payments): use logger" -q

    log_step "Scenario ready: 3 stacked commits on feat/payments"
    log_info "Context: logger -> payments -> refactor-using-logger (refactor depends on both prior groups)"
    log_info "Action:  /canon:git-split"
    log_info "Expect:  Stacked mode. 3 stacked branches/PRs. Merge-loop instructions in response"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
