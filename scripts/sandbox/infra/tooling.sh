#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-tooling-infra",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  git add .
  git commit -m "chore(sandbox): scaffold tooling infra test directory" --no-verify -q

  log_step "Tooling sandbox"
  log_info "sync        : syncs configs, seeds, deps, and gitignore entries for a stack"
  log_info "sync-drift  : sync with a pre-drifted markdown seed in place; seed must stay unchanged"
  log_info "sync-headless: headless run refuses to write without --write, then applies with it"
  log_info "reference   : prints a stack's reference doc, nothing written"
  log_info "reference-stale: an old installed copy sits in .claude/tooling/; the verb ignores it and sync leaves it alone"
  log_info "monorepo    : base at root, subtree synced with --skip base; only one .husky expected"
  log_info "create      : creates a new stack stub"
  log_info "list        : read-only catalog dump, no target needed"

  select_or_route_scenario "Which scenario?" "sync" "sync-drift" "sync-headless" "reference" "reference-stale" "monorepo" "create" "list"

  case "$SELECTED_OPTION" in
  "sync")
    log_step "Running: canon tooling sync"
    log_info "Expected: the report lists every path, then a prompt asks before anything is written."
    exec bun "$PROJECT_ROOT/src/cli.ts" tooling sync base .
    ;;
  "sync-drift")
    mkdir -p docs
    cat <<'EOF' >docs/development.md
---
title: Development (customized)
description: User-edited copy
---

# Development

Local dev workflow for this project.

## Setup

- Install dependencies with `bun install`.
EOF
    git add docs/development.md
    git commit -m "chore(sandbox): seed drifted docs/development.md" --no-verify -q

    log_step "Running: canon tooling sync base"
    log_info "docs/development.md is pre-populated with a drifted copy."
    log_info "After sync, diff HEAD -- docs/development.md should be empty."
    log_info "The report names it before the prompt, so the drift is visible ahead of the write."
    exec bun "$PROJECT_ROOT/src/cli.ts" tooling sync base .
    ;;
  "sync-headless")
    log_step "Running: CANON_NON_INTERACTIVE=1 canon tooling sync base ."
    log_info "Expected: the report lists every path, nothing is written, and the exit is 1."
    CANON_NON_INTERACTIVE=1 bun "$PROJECT_ROOT/src/cli.ts" tooling sync base . || log_info "Exit: $?"
    log_info "Expected: git status is clean, since the refusal wrote nothing."
    git status --short

    log_step "Running the same command with --write"
    log_info "Expected: every reported path lands and the exit is 0."
    exec bun "$PROJECT_ROOT/src/cli.ts" tooling sync base . --write
    ;;
  "reference")
    log_step "Running: canon tooling reference base"
    log_info "Expected: the reference doc prints to stdout. Nothing is written."
    exec bun "$PROJECT_ROOT/src/cli.ts" tooling reference base
    ;;
  "reference-stale")
    log_step "Staging a stale installed reference copy"
    mkdir -p .claude/tooling
    cat <<'EOF' >.claude/tooling/base.md
# Base reference (stale copy from before the read route shipped)

This file predates canon tooling reference and no command still writes it.
EOF
    git add .claude/tooling/base.md
    git commit -m "chore(sandbox): seed a stale installed reference copy" --no-verify -q

    log_step "Running: canon tooling reference base"
    log_info "Expected: prints the current tooling/base/reference.md doc, not the stale file above."
    bun "$PROJECT_ROOT/src/cli.ts" tooling reference base

    log_step "Running: CANON_NON_INTERACTIVE=1 canon tooling sync base . --write"
    log_info "Expected: the stale .claude/tooling/base.md is left untouched. diff HEAD -- .claude/tooling/base.md should be empty."
    CANON_NON_INTERACTIVE=1 bun "$PROJECT_ROOT/src/cli.ts" tooling sync base . --write
    log_step "Diffing the stale copy against HEAD"
    exec git diff HEAD -- .claude/tooling/base.md
    ;;
  "monorepo")
    log_step "Staging base tooling at repo root"
    CANON_NON_INTERACTIVE=1 bun "$PROJECT_ROOT/src/cli.ts" tooling sync base . --write
    bunx husky
    mkdir -p frontend

    log_step "Running: canon tooling sync vite-react ./frontend --skip base"
    log_info "Expected: frontend gets web and vite-react configs, no base configs."
    log_info "Expected: only the root .husky exists, no frontend/.husky."
    log_info "Expected: .github/ is withheld and named with 'working-directory: frontend', and frontend/cspell.json lands."
    exec bun "$PROJECT_ROOT/src/cli.ts" tooling sync vite-react ./frontend --skip base
    ;;
  "create")
    log_step "Running: canon tooling create"
    exec "$PROJECT_ROOT/scripts/tooling/create.sh"
    ;;
  "list")
    log_step "Running: canon tooling list"
    exec bun "$PROJECT_ROOT/src/cli.ts" tooling list
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
