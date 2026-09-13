#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "full" "small" "multi-concern" "constraint"

  case "$SELECTED_OPTION" in
  "full")
    cat <<'EOF' >package.json
{
  "name": "sandbox-feature",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

    cat <<'EOF' >>CLAUDE.md

# My App

Task management API with SQLite storage.

## Commands

- `bun run check`: lint and typecheck
- `bun run test`: run tests

## Behavior

- All database access goes through `src/db.ts`
- Route handlers live in `src/routes/`
- Use Zod for input validation
EOF

    mkdir -p .claude
    cat <<'EOF' >>canon/ARCHITECTURE.md

# Architecture

## Storage

SQLite via better-sqlite3. Single `src/db.ts` module owns the connection and exports typed query functions.

## API layer

Express routes in `src/routes/`. Each route file exports a router. `src/app.ts` mounts them.

## Validation

Zod schemas co-located with route files. Parse request bodies at the handler boundary.
EOF

    mkdir -p src src/routes
    cat <<'EOF' >src/db.ts
import Database from "better-sqlite3";

const db = new Database("tasks.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER DEFAULT 0
  )
`);

export function getTasks() {
  return db.prepare("SELECT * FROM tasks").all();
}

export function createTask(title: string) {
  return db.prepare("INSERT INTO tasks (title) VALUES (?)").run(title);
}
EOF

    cat <<'EOF' >src/routes/tasks.ts
import { Router } from "express";
import { getTasks, createTask } from "../db";

const router = Router();

router.get("/", (_req, res) => {
  res.json(getTasks());
});

router.post("/", (req, res) => {
  const { title } = req.body;
  const result = createTask(title);
  res.status(201).json({ id: result.lastInsertRowid });
});

export default router;
EOF

    mkdir -p .canon/tasks
    cat <<'EOF' >.canon/tasks/index.md
---
title: Tasks
subtitle: One file per task, ordered by phase label
---

# Tasks

One file per task, ordered by phase label

- [v01.0: Add due dates and priority to tasks](v01.0-due-dates.md): Persist and expose a due date and a priority on every task
EOF

    cat <<'EOF' >.canon/tasks/v01.0-due-dates.md
---
title: 'v01.0: Add due dates and priority to tasks'
description: Persist and expose a due date and a priority on every task
---

# v01.0: Add due dates and priority to tasks

Add a `due` (ISO date string, nullable) and `priority` (enum: low, medium, high, default medium) column to the tasks table. Expose both fields in the create and list endpoints. Validate with Zod.

- [ ] Outcome: tasks table has `due` and `priority` columns
- [ ] Outcome: POST /tasks accepts and persists both fields
- [ ] Outcome: GET /tasks returns both fields
EOF

    git add . && git commit -m "feat(api): initial task endpoints" --no-verify -q

    log_step "Scenario ready: feature planning (full mode)"
    log_info "Context: task API with SQLite, Express routes, CLAUDE.md, ARCHITECTURE.md, and .canon/tasks/ present"
    log_info "Action:  /plan-feature (reference the task in .canon/tasks/)"
    log_info "Expect:  plan written to .canon/plans/feature-<slug>.md with files to touch, risks, and questions, each question carrying a Suggested line and an Answer slot, and v01.0-due-dates.md's Plan: line points at it"
    ;;
  "small")
    cat <<'EOF' >CLAUDE.md
# My Project

Personal notes repo. Mostly markdown.
EOF

    cat <<'EOF' >README.md
# My Project

This here project is a place where i keep notes and stuff for my work and other things i am doing, the notes are in markdown and there is no real structure to it but i try to keep things organized in folders by topic so i can find them later when i need to look something up or remember what i was thinking about a particular subject at the time.
EOF

    mkdir -p .claude
    cat <<'EOF' >canon/DESIGN.md
# Design

SENTINEL: this file should NOT be read for prose-only changes. If the skill surfaces this content, the small-mode branch is broken.
EOF

    mkdir -p canon/wireframes
    rm -f canon/wireframes/feature-name.md
    cat <<'EOF' >canon/wireframes/index.md
---
title: Wireframes
subtitle: Per-surface ASCII layouts loaded on demand
---

# Wireframes

SENTINEL: this folder should NOT be read for prose-only changes. If the skill surfaces this content, the small-mode branch is broken.
EOF
    cat <<'EOF' >canon/wireframes/decoy.md
---
title: Decoy surface
description: Sentinel surface that should not be read for prose-only changes.
---

# Decoy surface

SENTINEL: this file should NOT be read for prose-only changes.
EOF

    mkdir -p .canon/tasks
    cat <<'EOF' >.canon/tasks/index.md
---
title: Tasks
subtitle: One file per task, ordered by phase label
---

# Tasks

One file per task, ordered by phase label

- [v01.0: Tighten the README intro paragraph](v01.0-readme-intro.md): Break the run-on opening paragraph into shorter sentences
EOF

    cat <<'EOF' >.canon/tasks/v01.0-readme-intro.md
---
title: 'v01.0: Tighten the README intro paragraph'
description: Break the run-on opening paragraph into shorter sentences
---

# v01.0: Tighten the README intro paragraph

The opening paragraph in `README.md` is one long run-on sentence. Break it into two or three shorter sentences with clearer structure.

- [ ] Outcome: README intro reads as 2-3 sentences instead of one run-on
EOF

    git add . && git commit -m "chore(notes): initial notes repo" --no-verify -q

    log_step "Scenario ready: feature planning (small mode)"
    log_info "Context: prose-only repo, single README task, decoy DESIGN and wireframes/ with sentinel text"
    log_info "Action:  /plan-feature (reference the task in .canon/tasks/)"
    log_info "Expect:  chat-only output, NO .canon/plans/ file written, decoys NOT surfaced"
    ;;
  "multi-concern")
    cat <<'EOF' >CLAUDE.md
# My App

Mixed repo: API endpoints plus a small docs site.
EOF

    mkdir -p src/routes docs
    cat <<'EOF' >src/routes/users.ts
import { Router } from "express";
const router = Router();
router.get("/", (_req, res) => res.json([]));
export default router;
EOF

    cat <<'EOF' >docs/intro.md
# Intro

Welcome to the project. This intro paragraph reads dry and dense, with one long run-on thought that does not break for the reader and keeps stacking clauses without giving the eye a place to rest.
EOF

    mkdir -p .canon/tasks
    cat <<'EOF' >.canon/tasks/index.md
---
title: Tasks
subtitle: One file per task, ordered by phase label
---

# Tasks

One file per task, ordered by phase label

- [v01.0: Add pagination to GET /users](v01.0-users-pagination.md): Page the user list with limit and offset query params
- [v02.0: Tighten the docs intro paragraph](v02.0-docs-intro.md): Break the run-on docs opening into two short paragraphs
EOF

    cat <<'EOF' >.canon/tasks/v01.0-users-pagination.md
---
title: 'v01.0: Add pagination to GET /users'
description: Page the user list with limit and offset query params
---

# v01.0: Add pagination to GET /users

- [ ] Outcome: GET /users supports limit and offset query params
- [ ] Outcome: defaults applied when params omitted
EOF

    cat <<'EOF' >.canon/tasks/v02.0-docs-intro.md
---
title: 'v02.0: Tighten the docs intro paragraph'
description: Break the run-on docs opening into two short paragraphs
---

# v02.0: Tighten the docs intro paragraph

- [ ] Outcome: intro reads as two short paragraphs instead of one run-on
EOF

    git add . && git commit -m "chore(sandbox): initial state" --no-verify -q

    log_step "Scenario ready: feature planning (multi-concern)"
    log_info "Context: two unrelated tasks in .canon/tasks/, one API change and one prose edit"
    log_info "Action:  /plan-feature 'add pagination to /users and tighten the docs intro'"
    log_info "Expect:  two plan files in .canon/plans/, one per concern, not a single bundled slug, and each task's Plan: line points at its own plan"
    ;;
  "constraint")
    cat <<'EOF' >CLAUDE.md
# My App

Data pipeline with a reference doc that has outgrown one file.
EOF

    mkdir -p docs canon/context
    cat <<'EOF' >docs/reference.md
# Reference

## Ingest

Rows arrive on the queue and land in the staging table.

## Transform

Staging rows are normalized and written to the warehouse.

## Export

Warehouse rows are published to the reporting bucket.
EOF

    cat <<'EOF' >docs/onboarding.md
# Onboarding

Read `docs/reference.md` for the pipeline stages before your first change.
EOF

    cat <<'EOF' >canon/context/pipeline.md
---
title: Pipeline
description: Stage boundaries and where each transform runs
---

# Pipeline

Stage boundaries are stated in `docs/reference.md`. The transform stage is the one carrying retries, and `docs/reference.md` covers the retry budget.
EOF

    mkdir -p .canon/tasks
    cat <<'EOF' >.canon/tasks/index.md
---
title: Tasks
subtitle: One file per task, ordered by phase label
---

# Tasks

One file per task, ordered by phase label

- [v01.0: Split the reference doc into a folder](v01.0-reference-split.md): Break docs/reference.md into one file per stage under docs/reference/
EOF

    cat <<'EOF' >.canon/tasks/v01.0-reference-split.md
---
title: 'v01.0: Split the reference doc into a folder'
description: Break docs/reference.md into one file per stage under docs/reference/
---

# v01.0: Split the reference doc into a folder

Break `docs/reference.md` into `docs/reference/` with one file per stage and an `index.md`. Two files cite the old path.

- [ ] Outcome: docs/reference/ carries one file per stage
- [ ] Outcome: no file cites the deleted docs/reference.md
EOF

    git add . && git commit -m "docs(reference): initial reference doc" --no-verify -q

    log_step "Scenario ready: feature planning (constraint)"
    log_info "Context: docs/reference.md split into a folder, cited by docs/onboarding.md and canon/context/pipeline.md"
    log_info "Action:  /plan-feature 'split docs/reference.md per the task. Constraint: leave canon/context/pipeline.md alone.'"
    log_info "Expect:  the plan's Constraints entry resolves both acts for pipeline.md, forbidding conforming it to the new shape and requiring its citations of the deleted path be retargeted, and v01.0-reference-split.md's Plan: line points at the plan"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
