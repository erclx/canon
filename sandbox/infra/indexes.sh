#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-git.sh"

seed_folder() {
  mkdir -p docs
  cat <<'EOF' >docs/index.md
---
title: Docs
subtitle: Sample folder index for sandbox
---

# Stale content that should be overwritten
EOF
  cat <<'EOF' >docs/alpha.md
---
title: Alpha
description: First sample entry
---

# Alpha
EOF
  cat <<'EOF' >docs/beta.md
---
title: Beta
description: Second sample entry
---

# Beta
EOF
}

seed_nested_folder() {
  seed_folder
  mkdir -p docs/guides
  cat <<'EOF' >docs/guides/index.md
---
title: Guides
subtitle: Step-by-step how-tos
---

# Stale content that should be overwritten
EOF
  cat <<'EOF' >docs/guides/setup.md
---
title: Setup
description: Local environment bootstrap
---

# Setup
EOF
  cat <<'EOF' >docs/guides/deploy.md
---
title: Deploy
description: Release and rollback steps
---

# Deploy
EOF
}

seed_bare_folder() {
  mkdir -p docs
  cat <<'EOF' >CLAUDE.md
# Project

Sample project for testing the indexes phase of the setup skill.

## Rules

- When editing any markdown file, follow project prose conventions.
EOF
  cat <<'EOF' >docs/architecture.md
# Architecture

System boundaries and module responsibilities for the sample project. Defines how the API gateway forwards requests to the worker pool and where state persists.

## Sections

Body content for the architecture doc goes here.
EOF
  cat <<'EOF' >docs/onboarding.md
# Onboarding

Steps for a new contributor to clone the repo, install dependencies, and run the dev loop end to end.

## Sections

Body content for the onboarding doc goes here.
EOF
  cat <<'EOF' >docs/deployment.md
# Deployment

Build, package, and release workflow for staging and production environments. Covers rollback procedure and post-deploy verification.

## Sections

Body content for the deployment doc goes here.
EOF
  cat <<'EOF' >docs/troubleshooting.md
# Troubleshooting

Common failure modes for the worker pool, with the symptom each surfaces and the recovery action that resolves it.

## Sections

Body content for the troubleshooting doc goes here.
EOF
  cat <<'EOF' >docs/glossary.md
# Glossary

Domain terms used across the codebase. Each entry is a single sentence so the doc stays scannable as the system grows.

## Sections

Body content for the glossary doc goes here.
EOF
}

seed_no_candidate() {
  cat <<'EOF' >CLAUDE.md
# Project

Sample project for testing the indexes phase of the setup skill on an empty scan.
EOF
}

seed_git_repo() {
  seed_folder
  git init -q
  configure_sandbox_git_identity
  git add . && git commit -q -m "chore: seed indexed docs"
  sed -i 's/description: First sample entry/description: Updated first entry/' docs/alpha.md
  git add docs/alpha.md
}

stage_setup() {
  log_step "Indexes sandbox"
  log_info "regen       : walks CWD and rewrites every index.md"
  log_info "nested      : parent index links a child folder's index.md"
  log_info "dry-run     : reports drift without writing (exits 2 on drift)"
  log_info "json        : emits machine-readable records on stdout"
  log_info "opt-out     : adds auto: false to index.md and confirms skip"
  log_info "path        : passes a positional file and confirms walk-up"
  log_info "lint-staged : stages sibling, regen stages regenerated index"
  log_info "no-stage    : same as lint-staged but --no-stage skips git add"
  log_info "bootstrap   : seeds raw markdown for the indexes phase of the setup skill"
  log_info "no-candidate: bare CLAUDE.md, no markdown-heavy folder to bootstrap"

  select_or_route_scenario "Which scenario?" "regen" "nested" "dry-run" "json" "opt-out" "path" "lint-staged" "no-stage" "bootstrap" "no-candidate"

  case "$SELECTED_OPTION" in
  "regen")
    seed_folder
    log_step "Running: canon indexes regen"
    exec bun "$PROJECT_ROOT/src/cli.ts" indexes regen
    ;;
  "nested")
    seed_nested_folder
    log_step "Running: canon indexes regen"
    bun "$PROJECT_ROOT/src/cli.ts" indexes regen
    log_step "Generated docs/index.md"
    pipe_output <docs/index.md
    log_info "Expect: docs/index.md links guides/index.md after the sibling files"
    ;;
  "dry-run")
    seed_folder
    log_step "Running: canon indexes regen --dry-run"
    # Captured rather than exec'd, mirroring infra:gov's test-order arm: the
    # status is held rather than left to set -e, since --dry-run exits 2 on
    # drift by design and an abort here would kill the scenario on the outcome
    # the arm exists to observe.
    local dry_run_status=0
    bun "$PROJECT_ROOT/src/cli.ts" indexes regen --dry-run \
      >dry-run-output.log 2>dry-run-frame.log || dry_run_status=$?
    printf '%s\n' "$dry_run_status" >dry-run-status.txt
    cat dry-run-frame.log >&2
    log_info "dry-run-status.txt carries the exit the run produced"
    log_info "Expect: declared in fixtures/infra/indexes/dry-run/expect.toml"
    ;;
  "json")
    seed_folder
    log_step "Running: canon indexes regen --dry-run --json"
    local json_status=0
    bun "$PROJECT_ROOT/src/cli.ts" indexes regen --dry-run --json \
      >json-record.json 2>json-frame.log || json_status=$?
    printf '%s\n' "$json_status" >json-status.txt
    cat json-frame.log >&2
    cat json-record.json >&2
    log_info "json-record.json carries a machine-readable record per index"
    log_info "Expect: declared in fixtures/infra/indexes/json/expect.toml"
    ;;
  "opt-out")
    seed_folder
    log_step "Setting auto: false on docs/index.md"
    sed -i '2i\auto: false' docs/index.md
    log_step "Running: canon indexes regen"
    exec bun "$PROJECT_ROOT/src/cli.ts" indexes regen
    ;;
  "path")
    seed_folder
    log_step "Running: canon indexes regen docs/alpha.md"
    exec bun "$PROJECT_ROOT/src/cli.ts" indexes regen docs/alpha.md
    ;;
  "lint-staged")
    seed_git_repo
    log_step "Running: canon indexes regen docs/alpha.md"
    bun "$PROJECT_ROOT/src/cli.ts" indexes regen docs/alpha.md
    log_step "git diff --cached --name-only"
    git diff --cached --name-only >lint-staged-diff.txt
    cat lint-staged-diff.txt >&2
    log_step "git status --short"
    git status --short | pipe_output
    log_info "lint-staged-diff.txt carries the cached diff name list"
    log_info "Expect: docs/index.md present in the cached diff (auto-staged)"
    ;;
  "no-stage")
    seed_git_repo
    log_step "Running: canon indexes regen --no-stage docs/alpha.md"
    bun "$PROJECT_ROOT/src/cli.ts" indexes regen --no-stage docs/alpha.md
    log_step "git diff --cached --name-only"
    git diff --cached --name-only >no-stage-diff.txt
    cat no-stage-diff.txt >&2
    log_step "git status --short"
    git status --short | pipe_output
    log_info "no-stage-diff.txt carries the cached diff name list"
    log_info "Expect: docs/index.md modified in working tree but NOT in cached diff"
    ;;
  "bootstrap")
    seed_bare_folder
    log_step "Seeded docs/ with 5 raw markdown files (no frontmatter, no index.md)"
    log_info "Open Claude in this sandbox and invoke /canon:target-setup indexes"
    log_info "The skill should detect docs/ as a candidate and walk the bootstrap flow"
    ;;
  "no-candidate")
    seed_no_candidate
    log_step "Seeded a bare CLAUDE.md with no markdown-heavy folder anywhere"
    log_info "Open Claude in this sandbox and invoke /canon:target-setup indexes"
    log_info "The skill should report an empty scan and skip straight to the convention seed offer"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
