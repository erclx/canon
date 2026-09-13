#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

seed_duplicated_workspace() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-groundwork",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"]
}
EOF

  cat <<'EOF' >>CLAUDE.md

# My Workspace

Three-package workspace. Each package owns its own build and lint config.

## Commands

- `bun run check`: lint and typecheck every package
EOF

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

    cat <<'EOF' >"packages/$pkg/tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
EOF
  done

  cat <<'EOF' >packages/api/eslint.config.js
export default [
  { rules: { "no-console": "error", eqeqeq: "error", "no-unused-vars": "error" } },
];
EOF

  cat <<'EOF' >packages/web/eslint.config.js
export default [
  { rules: { "no-console": "warn", eqeqeq: "error", "prefer-const": "error" } },
];
EOF

  cat <<'EOF' >packages/worker/eslint.config.js
export default [
  { rules: { "no-console": "off", "no-unused-vars": "warn" } },
];
EOF

  cat <<'EOF' >packages/web/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": false,
    "jsx": "react-jsx",
    "noEmit": true
  },
  "include": ["src"]
}
EOF

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
    cat <<'EOF' >>canon/ARCHITECTURE.md

# Architecture

## Packages

Three independent packages under `packages/`. Each was scaffolded separately and carries its own `tsconfig.json` and `eslint.config.js`.

## Tooling

No shared preset exists. Config drift between packages has never been measured.
EOF

    mkdir -p .canon/tasks
    cat <<'EOF' >.canon/tasks/index.md
---
title: Tasks
subtitle: One file per task, ordered by phase label
---

# Tasks

One file per task, ordered by phase label

- [v01.0: Decide what to do about tooling config drift](v01.0-config-drift.md): Settle whether the three packages share tooling config
EOF

    cat <<'EOF' >.canon/tasks/v01.0-config-drift.md
---
title: 'v01.0: Decide what to do about tooling config drift'
description: Settle whether the three packages share tooling config
---

# v01.0: Decide what to do about tooling config drift

The three packages each carry their own lint and TypeScript config. Nobody knows how far apart they are. Candidate approaches: extract a shared preset package, adopt a single root config with per-package overrides, or leave them independent.

- [ ] Outcome: a decision backed by a measurement of the actual drift
EOF

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
    cat <<'EOF' >.canon/groundwork/01-tooling-drift/README.md
---
title: Tooling drift
description: Whether the three packages should share a tooling preset, and how far their configs have drifted
date: 2026-07-20
---

# Tooling drift

Groundwork phase. Nothing here is a feature plan.

Whether the three packages should share a tooling preset.

## Why

Each package was scaffolded separately. A change to a lint rule currently has to be
made three times, and nobody has measured how far the configs have actually drifted.

## Files

| File | Holds |
| ---- | ----- |
| `01-current-state.md` | Measured config drift across the three packages |

## Method

Internal: direct read of every `eslint.config.js` and `tsconfig.json` under `packages/`.
External: not yet done. Shared-preset patterns from comparable workspaces are unread.

## Prior art

None. This is the first pass at the question.
EOF

    cat <<'EOF' >.canon/groundwork/01-tooling-drift/01-current-state.md
# Current state

Verified facts only, measured 2026-07-20.

## Lint config

Measured when the workspace held two packages.

- `packages/api/eslint.config.js`: 3 rules
- `packages/web/eslint.config.js`: 3 rules

## Open questions

1. Do the tsconfig compiler options differ in ways that would break a shared base? Open.
2. Is a preset package or a root config with overrides the better shape? Open.
EOF

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
    cat <<'EOF' >package.json
{
  "name": "sandbox-groundwork-decline",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

    cat <<'EOF' >>CLAUDE.md

# My App

Small CLI. Single entry point.
EOF

    mkdir -p src .claude
    cat <<'EOF' >src/cli.ts
export function run(args: string[]) {
  if (args.includes("--version")) {
    console.log("1.0.0");
    return;
  }
  console.log("usage: cli [--version]");
}
EOF

    mkdir -p .canon/tasks
    cat <<'EOF' >.canon/tasks/index.md
---
title: Tasks
subtitle: One file per task, ordered by phase label
---

# Tasks

One file per task, ordered by phase label

- [v01.0: Add a --help flag to the CLI](v01.0-help-flag.md): Print the usage line explicitly behind a --help flag
EOF

    cat <<'EOF' >.canon/tasks/v01.0-help-flag.md
---
title: 'v01.0: Add a --help flag to the CLI'
description: Print the usage line explicitly behind a --help flag
---

# v01.0: Add a --help flag to the CLI

The CLI already prints a usage line for unknown input. Add a `--help` flag that prints the same usage line explicitly. Decided: mirror the existing `--version` branch in `src/cli.ts`.

- [ ] Outcome: `cli --help` prints the usage line
EOF

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
