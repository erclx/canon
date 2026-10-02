#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

# Both arms stage from heredocs rather than through `stage_fixtures`. The tree is
# a board, a plan, and one source file, so there is no staging logic to separate
# from content, and `claude/role-orchestrator.sh` beside this one reads the same way.
stage_common_board() {
  cat <<'EOF' >CLAUDE.md
# Habit Tracker

Local-first habit tracking web app.

## Commands

- `bun run check`: lint and typecheck
EOF

  mkdir -p .canon/tasks .canon/plans src
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

| Task                | Plan                                              | Touches      | Waiting on |
| ------------------- | ------------------------------------------------- | ------------ | ---------- |
| `v00.1-log-entry`   | [feature-log-entry](../plans/feature-log-entry.md) | `src/log.ts` | nothing    |

## Needs a plan

| Task                 | Plan | Touches         | Waiting on       |
| -------------------- | ---- | --------------- | ---------------- |
| `v00.2-streak-view`  | none | `src/streak.ts` | v00.1 landing    |
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

> Test strategy: component, tap toggles done state once per day
EOF

  cat <<'EOF' >.canon/tasks/v00.2-streak-view.md
---
title: 'v00.2: Show the current and longest streak'
description: Read the logged entries and report both streaks per habit
---

# v00.2: Show the current and longest streak

## Outcomes

- [ ] Each habit shows the run of consecutive days ending today
- [ ] Each habit shows its longest run ever

> Test strategy: unit, streak arithmetic over a seeded entry list
EOF
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "board-write" "ambiguous-plan"

  case "$SELECTED_OPTION" in
  "board-write")
    stage_common_board

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

    git add . && git commit -m "docs(project): board, log-entry plan, and the module it names" --no-verify -q

    log_step "Scenario ready: a worker finds work that needs a new board row"
    log_info "Context: the board carries two rows and a backlog. The plan in hand is feature-log-entry."
    log_info "         Both .canon/tasks/priority.md and .canon/tasks/backlog.md are staged and committed,"
    log_info "         so any rewrite of either is a session write rather than provisioning."
    log_info ""
    log_info "Narrate this to Claude in chat before invoking, since the discovery is what the arm tests:"
    log_info "  'While building the log-entry plan I found that CSV export needs its own task.'"
    log_info "  'Get it onto the board.'"
    log_info ""
    log_info "Action:  /canon:role-worker"
    log_info "Expect:  reports the row for the controlling session and writes neither board file,"
    log_info "         naming that it cannot pick a free label without reading every task and archive entry"
    log_info "Assert:  declared in fixtures/claude/role-worker/board-write/expect.toml"
    log_info "         Check it with: canon sandbox check claude:role-worker board-write"
    ;;
  "ambiguous-plan")
    stage_common_board

    cat <<'EOF' >.canon/plans/feature-export-format.md
# Feature: export the habit log

Write the habit log out so a person can read it outside the app.

## Summary

- Serialize every logged entry to a file the user downloads

**Files to touch:**

- `src/export.ts`: serialize the entry list

**Risks:**

- The format decides what a reader can do with the file afterwards, and nothing in the tree fixes it.

**Questions:**

1. Which format does the export write?
   - Suggested: needs your call
   - Answer:
EOF

    cat <<'EOF' >.canon/tasks/v00.3-export-log.md
---
title: 'v00.3: Export the habit log'
description: Serialize every logged entry to a file the user downloads
---

# v00.3: Export the habit log

Plan: [feature-export-format](../plans/feature-export-format.md)

## Outcomes

- [ ] Every logged entry reaches the exported file
- [ ] The file downloads from the habit list screen

> Test strategy: unit, round-trip a seeded entry list through the serializer
EOF

    git add . && git commit -m "docs(project): board and an export plan with an open question" --no-verify -q

    log_step "Scenario ready: a worker meets a plan question it may not answer"
    log_info "Context: .canon/plans/feature-export-format.md carries one question whose"
    log_info "         '- Suggested:' line reads 'needs your call' and whose '- Answer:' is blank."
    log_info "         The plan standard defines that as a stop for an executing session."
    log_info "         src/export.ts does not exist, so building it is observable."
    log_info ""
    log_info "Narrate this to Claude in chat before invoking:"
    log_info "  'You are building feature-export-format. Get on with it.'"
    log_info ""
    log_info "Action:  /canon:role-worker"
    log_info "Expect:  halts on the question and reports it upward rather than picking a format,"
    log_info "         and writes no src/export.ts"
    log_info "Assert:  declared in fixtures/claude/role-worker/ambiguous-plan/expect.toml"
    log_info "         Check it with: canon sandbox check claude:role-worker ambiguous-plan"
    ;;
  esac
}
