#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  cat <<'EOF' >CLAUDE.md
# Habit Tracker

Local-first habit tracking web app.

## Commands

- `bun run check`: lint and typecheck
EOF

  mkdir -p .canon/plans .claude
  cat <<'EOF' >canon/REQUIREMENTS.md
# Requirements

## MVP features

1. Log entry: mark a habit done for today with one tap
2. Streak view: show current and longest streak per habit
3. Trend chart: weekly and monthly completion chart
EOF

  mkdir -p .canon/tasks
  cat <<'EOF' >.canon/tasks/index.md
---
title: Tasks
subtitle: One file per task, ordered by phase label
---

# Tasks

One file per task, ordered by phase label

- [v00.1: Log a habit with one tap](v00.1-log-entry.md): Mark a habit done for today with a single tap
- [v00.2: Show the current and longest streak](v00.2-streak-view.md): Read the logged entries and report both streaks per habit
EOF

  cat <<'EOF' >.canon/tasks/priority.md
# Priority

## Run now

- `v00.1-log-entry`: plan written, ready to hand off

## Needs a plan

- `v00.2-streak-view`: no plan yet
EOF

  cat <<'EOF' >.canon/tasks/v00.1-log-entry.md
---
title: 'v00.1: Log a habit with one tap'
description: Mark a habit done for today with a single tap
---

# v00.1: Log a habit with one tap

- [ ] Outcome: tapping a habit marks it done for today
- [ ] Outcome: a second tap the same day is a no-op

> Test strategy: component, tap toggles done state once per day
EOF

  cat <<'EOF' >.canon/tasks/v00.2-streak-view.md
---
title: 'v00.2: Show the current and longest streak'
description: Read the logged entries and report both streaks per habit
---

# v00.2: Show the current and longest streak

- [ ] Outcome: each habit shows the run of consecutive days ending today
- [ ] Outcome: each habit shows its longest run ever

> Test strategy: unit, streak arithmetic over a seeded entry list
EOF

  cat <<'EOF' >.canon/plans/feature-log-entry.md
# Feature: log entry

Mark a habit done for today with one tap, idempotent per day.

**Files to touch:**

- `src/log.ts`: record a dated entry, no-op on repeat

**Risks:**

None identified.

**Questions:**

None identified.
EOF

  git add . && git commit -m "docs(project): requirements, tasks, and log-entry plan" --no-verify -q

  log_step "Scenario ready: orchestrator board readout"
  log_info "Context: priority.md groups the board, a plan for log-entry, none for streak-view"
  log_info "Action:  /role-orchestrator"
  log_info "Expect:  no version line at all, since no file states one,"
  log_info "         order read from priority.md rather than inferred from index.md,"
  log_info "         log-entry ready to hand to a worker (has plan), streak-view needs /plan-feature first,"
  log_info "         a single Next action, and In review omitted (no open PRs in this fixture)"
  log_info "Assert:  declared in fixtures/claude/role-orchestrator/expect.toml"
}
