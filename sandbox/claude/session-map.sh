#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-session-map",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  # The seeds provide this file. Fail rather than create it, since an absent
  # target means the injected tree changed shape and appending would provision a
  # project carrying this section alone.
  [ -f CLAUDE.md ] || log_error "No CLAUDE.md to append to. SANDBOX_INJECT_SEEDS provisions one."

  cat <<'EOF' >>CLAUDE.md

# My App

Task management API.

## Commands

- `bun run check`: lint and typecheck
EOF

  mkdir -p src/routes .canon/tasks .canon/plans

  cat <<'EOF' >src/routes/tasks.ts
export function listTasks(): string[] {
  return []
}
EOF

  cat <<'EOF' >.canon/tasks/index.md
---
title: Tasks
subtitle: One file per task, ordered by phase label
---

# Tasks

One file per task, ordered by phase label

- [v01.0: Rate limit the task API](v01.0-rate-limit.md): Reject a client that exceeds the request budget for a window
- [v02.0: Paginate the task list](v02.0-pagination.md): Return a bounded page of tasks instead of the whole collection
- [v03.0: Export the task list as CSV](v03.0-csv-export.md): Serve the collection as a downloadable CSV file
EOF

  cat <<'EOF' >.canon/tasks/v01.0-rate-limit.md
---
title: 'v01.0: Rate limit the task API'
description: Reject a client that exceeds the request budget for a window
---

# v01.0: Rate limit the task API

Plan: [feature-rate-limit](../plans/feature-rate-limit.md)

- [x] Outcome: a client over the request budget is rejected
- [x] Outcome: the budget resets on a rolling window

> Test strategy: unit, drive the limiter past the budget and past the window.
EOF

  cat <<'EOF' >.canon/tasks/v02.0-pagination.md
---
title: 'v02.0: Paginate the task list'
description: Return a bounded page of tasks instead of the whole collection
---

# v02.0: Paginate the task list

Plan: [feature-pagination](../plans/feature-pagination.md)

- [ ] Outcome: a list request accepts a page size and an offset
- [ ] Outcome: a response reports the total count alongside the page

> Test strategy: integration, request successive pages and verify no overlap.
EOF

  cat <<'EOF' >.canon/tasks/v03.0-csv-export.md
---
title: 'v03.0: Export the task list as CSV'
description: Serve the collection as a downloadable CSV file
---

# v03.0: Export the task list as CSV

Plan: [feature-csv-export](../plans/feature-csv-export.md)

- [ ] Outcome: a request for the CSV form returns every task as a row
- [ ] Outcome: a title carrying a comma survives the round trip

> Test strategy: integration, request the CSV form and parse the rows back.
EOF

  cat <<'EOF' >.canon/plans/feature-rate-limit.md
# Feature: rate limit the task API

Reject a client that exceeds the request budget for a window, and reset the
budget on a rolling window rather than on a fixed one.
EOF

  cat <<'EOF' >.canon/plans/feature-pagination.md
# Feature: paginate the task list

Return a bounded page of tasks from the list route, and report the total count
alongside the page so a caller can size the rest.
EOF

  cat <<'EOF' >.canon/plans/feature-csv-export.md
# Feature: export the task list as CSV

Serve the collection as CSV from the existing list route, quoting a title that
carries a comma so the rows parse back.

**Files to touch:**

- `src/routes/export.ts`: the CSV serializer and the route that serves it
EOF

  git add . && git commit -m "feat(api): scaffold the task API and its board" --no-verify -q

  git checkout -b feat/csv-export -q

  # Left untracked on purpose. `## State` owes the reader any untracked file that
  # needs committing, so a map filled from boilerplate rather than from a read of
  # the tree is separable from one filled correctly.
  cat <<'EOF' >src/routes/export.ts
export function toCsv(rows: string[]): string {
  return rows.join('\n')
}
EOF

  log_step "Scenario ready: a cold session on a feature branch with a board to report on"
  log_info "Context: the branch is feat/csv-export, so the slug drops the type and"
  log_info "  the map lands at .canon/tasks/session-csv-export.md"
  log_info "  The board carries v01.0 shipped and v02.0 and v03.0 open, and"
  log_info "  Every board row resolves to a plan, so a dangling link is never"
  log_info "  state a cold session has to report"
  log_info "  .canon/plans/feature-csv-export.md is the plan behind the branch"
  log_info "  src/routes/export.ts is untracked, which is what ## State owes a reader"
  log_info ""
  log_info "The project carries no claude/skills/ corpus, so the drift step's verb"
  log_info "refuses and the map records the refusal rather than a name. The only"
  log_info "commit is newer than any session window, so the elapsed-time ref"
  log_info "recovery returns empty and item 3 of the standard answers it."
  log_info ""
  log_info "Both defects this arm covers came out of cold headless runs recorded on"
  log_info "pull request #1097, which states their conditions rather than the"
  log_info "prompt each used. Those runs named no skill, to settle routing. This"
  log_info "arm names one, since routing is settled and the steps are not."
  log_info ""
  log_info "Action:  /canon:session-map"
  log_info "Expect:  declared in fixtures/claude/session-map/expect.toml"
  log_info "         Check it with: canon sandbox check claude:session-map"
  log_info "         A map carrying the three core sections, the drift verb's own"
  log_info "         refusal, and the untracked file. The board ends the run"
  log_info "         untouched."
  log_info "         What the map says about the empty window is a reader"
  log_info "         expectation, since item 3 fixes what a writer must say and"
  log_info "         not the words to say it in."
  log_info "         Five expectations need a reader and report as unchecked."
}
