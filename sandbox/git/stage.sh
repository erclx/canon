#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-git.sh"

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  git init -q
  configure_sandbox_git_identity

  mkdir -p docs
  echo "# My App" >README.md
  printf "# Old API Reference\n\nDeprecated.\n" >docs/old-api.md
  git add . && git commit -m "chore(project): init" -q

  mkdir -p src/auth src/api

  echo 'export function login(user) { return fetch("/api/login", { body: user }); }' >src/auth/login.js
  echo 'export function logout() { return fetch("/api/logout"); }' >src/auth/logout.js
  echo "export function getUser(id) { return fetch(\`/api/users/\${id}\`); }" >src/api/users.js
  printf "# Auth module\n\nHandles login and logout.\n" >docs/auth.md
  echo '{ "name": "my-app", "version": "1.1.0" }' >package.json

  git rm docs/old-api.md -q
  git add src/auth/login.js src/auth/logout.js src/api/users.js docs/auth.md package.json

  log_step "Scenario ready: 6 staged changes across mixed concerns"
  log_info "Context: 2 auth files, 1 api file, 1 doc, 1 config change, 1 deletion, all staged"
  log_info "Action:  /canon:git-stage"
  log_info "Expect:  groups auth + api separately, docs solo, config solo. Uses git rm for deletion"
}
