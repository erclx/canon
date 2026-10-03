#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

seed_duplicated_workspace() {
  stage_fixtures claude plan-groundwork shared duplicated-workspace

  local pkg
  for pkg in api web worker; do
    mkdir -p "packages/$pkg/src"

    cat <<EOF >"packages/$pkg/package.json"
{
  "name": "@sandbox/$pkg",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "eslint src",
    "typecheck": "tsc --noEmit"
  }
}
EOF

  done

  echo 'export const api = () => "api";' >packages/api/src/index.ts
  echo 'export const web = () => "web";' >packages/web/src/index.ts
  echo 'export const worker = () => "worker";' >packages/worker/src/index.ts
}

stage_setup() {
  log_step "Groundwork sandbox"
  log_info "open    : drifted workspace, no .canon/groundwork/ folder yet"
  log_info "resume  : live folder with README.md and 01-current-state.md, no decision"
  log_info "decline : one-file change already decided in .canon/tasks/"
  log_info ""
  log_info "Invoke the prefixed form. The dev-skill injection copies SKILL.md alone,"
  log_info "so the unprefixed copy cannot resolve the bundled standards/groundwork.md."
  log_info "Launch with: claude --plugin-dir <worktree-root>/claude --model sonnet"

  select_or_route_scenario "Which scenario?" "open" "resume" "decline"

  case "$SELECTED_OPTION" in
  "open")
    seed_duplicated_workspace

    mkdir -p .claude
    stage_fixtures claude plan-groundwork open 01-initial

    mkdir -p .canon/tasks

    git add . && git commit -m "feat(workspace): three packages with independent tooling" --no-verify -q

    log_step "Scenario ready: groundwork open mode"
    log_info "Context: three packages with drifted eslint and tsconfig, drift never measured"
    log_info "         Two or more approaches are live and no .canon/groundwork/ folder exists"
    log_info "Action:  /canon:plan-groundwork tooling config drift across the three packages"
    log_info "Expect:  qualifying test passes, folder created at .canon/groundwork/<nn>-<slug>/"
    log_info "         README.md written first, then 01-current-state.md with measured drift"
    log_info "         NOTHING written to .canon/plans/, packages/, or any config file"
    log_info "         Output lists full relative paths and the open questions"
    ;;
  "resume")
    seed_duplicated_workspace

    mkdir -p .canon/groundwork/01-tooling-drift
    stage_fixtures claude plan-groundwork resume 01-initial

    git add . && git commit -m "feat(workspace): three packages with independent tooling" --no-verify -q

    log_step "Scenario ready: groundwork resume mode"
    log_info "Context: .canon/groundwork/01-tooling-drift/ exists with README.md and 01-current-state.md"
    log_info "         No 06-decision.md, so the folder is live"
    log_info "         01-current-state.md was measured at two packages and the workspace now has three"
    log_info "         It carries two open questions at the end"
    log_info "Action:  /canon:plan-groundwork tooling drift"
    log_info "Expect:  resume detected from the folder, never asked about"
    log_info "         README.md and its file map read first, then 01-current-state.md"
    log_info "         Continues from the two open questions instead of restarting the folder"
    log_info "         Re-measures only because the project moved, and marks what changed"
    ;;
  "decline")
    stage_fixtures claude plan-groundwork decline 01-initial

    mkdir -p src .claude

    mkdir -p .canon/tasks

    git add . && git commit -m "feat(cli): version flag and usage line" --no-verify -q

    log_step "Scenario ready: groundwork qualifying test declines"
    log_info "Context: one-file change, current state known, approach already decided in .canon/tasks/"
    log_info "         Only one of the three qualifying tests can hold"
    log_info "Action:  /canon:plan-groundwork adding a --help flag"
    log_info "Expect:  skill declines and points at /plan-feature"
    log_info "         NO folder created under .canon/groundwork/"
    log_info "         No measuring pass, no README.md"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
