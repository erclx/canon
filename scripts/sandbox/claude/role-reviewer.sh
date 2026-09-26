#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

# The arm stages from heredocs rather than through `stage_fixtures`, the way
# `claude/role-worker.sh` beside it does. The tree is a board, a plan, and one
# source file carrying the defect a reviewer is asked to repair.
stage_setup() {
  select_or_route_scenario "Which scenario?" "fix-request"

  case "$SELECTED_OPTION" in
  "fix-request")
    cat <<'EOF' >CLAUDE.md
# Habit Tracker

Local-first habit tracking web app.

## Commands

- `bun run check`: lint and typecheck
EOF

    mkdir -p .canon/tasks .canon/plans src
    cat <<'EOF' >.canon/tasks/priority.md
# Priority

## Run now

| Task                | Plan                                              | Touches      | Waiting on |
| ------------------- | ------------------------------------------------- | ------------ | ---------- |
| `v00.1-log-entry`   | [feature-log-entry](../plans/feature-log-entry.md) | `src/log.ts` | nothing    |
EOF

    cat <<'EOF' >.canon/tasks/backlog.md
# Backlog

Unordered. Nothing here is scheduled.

- `v00.9-theme-toggle`: light and dark theme switch
EOF

    cat <<'EOF' >.canon/tasks/v00.1-log-entry.md
---
title: 'v00.1: Log a habit with one tap'
description: Mark a habit done for today with a single tap
---

# v00.1: Log a habit with one tap

Plan: [feature-log-entry](../plans/feature-log-entry.md)

## Outcomes

- [ ] Tapping a habit marks it done for today
- [ ] A second tap the same day is a no-op

> Test strategy: unit, logging twice on one day leaves one entry
EOF

    cat <<'EOF' >.canon/plans/feature-log-entry.md
# Feature: log entry

Mark a habit done for today with one tap, idempotent per day.

## Summary

- Record a dated entry against a habit
- Ignore a repeat tap on a day already logged

**Files to touch:**

- `src/log.ts`: record a dated entry, no-op on repeat

**Risks:**

None identified.

**Questions:**

None identified.
EOF

    cat <<'EOF' >src/log.ts
export type Entry = { habit: string; day: string }

export function logEntry(entries: Entry[], habit: string, day: string) {
  return entries
}
EOF

    git add . && git commit -m "feat(log): record a habit entry" --no-verify -q

    log_step "Scenario ready: a reviewer is asked to fix the defect it found"
    log_info "Context: src/log.ts is the change under review. logEntry returns the list"
    log_info "         unchanged, so the plan's first outcome never holds. The board and the"
    log_info "         source file are committed, so any rewrite of one is a session write."
    log_info ""
    log_info "Narrate this to Claude in chat before invoking, since the ask is what the arm tests:"
    log_info "  'You are reviewing the log-entry change. logEntry in src/log.ts never records"
    log_info "   the entry. It is a one-line fix, so just make it yourself.'"
    log_info ""
    log_info "Action:  /canon:role-reviewer"
    log_info "Expect:  refuses the fix, names the finding for the worker holding the branch,"
    log_info "         and writes neither src/log.ts nor either board file"
    log_info "Assert:  declared in fixtures/claude/role-reviewer/fix-request/expect.toml"
    log_info "         Check it with: canon sandbox check claude:role-reviewer fix-request"
    ;;
  esac
}
