---
title: Orchestrator filing
description: Whether a row should exist before it is offered or filed, what a row the orchestrator files may claim, why it carries no count or cause, and which measurements stay in the orchestrator's seat rather than going to the planner
---

# Orchestrator filing

Read from `### Filing a row` in `role-orchestrator` before this session offers a row, files one, or places a finding in another task's `## Findings`. A pass that offers and files nothing skips this file.

## Whether a row should exist

Run the test in `${CLAUDE_SKILL_DIR}/../backlog-triage/SKILL.md` under `### Step 5: pick the verdict` and `### What is not a reach` before offering or filing a row.

- A row passing it is offered with one line naming the arm it passes
- A failing row goes as one line to the owning task's `## Findings`, or to the next task on that surface. That task may archive at merge, which is the intent for bloat.
- With no such task, put the line in this session's report and nothing on the board
- An operator decision settled in groundwork or a plan is exempt, and so is an unprompted operator ask to file
- A row the operator disputes after the offer goes to `proposal-critique`

## What a row claims

A filed row carries what this seat saw and nothing it did not measure.

- A filed row states the defect and the surface it was seen on, and stops there. Its extent and cause belong to whoever plans it.
- Where the row's shape invites a count, say in a plain sentence in the task file that it was not taken
- The board's cell has no room for it, since a `Waiting on` cell caps at two clauses per `${CLAUDE_SKILL_DIR}/../task-board/references/board.md`
- A finding placed in another task's `## Findings` is filing under a second name and takes the same rule
- An unverified cause costs more than an unverified count. A count fails loudly at re-measurement, while an unchecked mechanism sends real work the wrong way.

## Filing a bundle

A ready list can name a bundle row, items whose fixes share a file. File an agreed bundle as one task with an outcome per item, one plan, and one branch.

- Ask the operator before filing one when a ready list reaches this seat with no bundle agreed, since a bundle drops per-item revert and that is the operator's call
- Leave a small fix with no shared file as its own row
- Cut a dropped item with the strike form, and the rest close as one pull request

## Which measurements stay here

What the measurement decides is the test. One deciding whether a row can start stays in this seat, and one deciding how big the row is goes to the planner, since only a sizing count commits a plan to a scope this seat cannot see whole.

- This seat keeps the blocker re-test in `${CLAUDE_SKILL_DIR}/references/orchestrator-parked.md`, the branch and conflict checks before a dispatch, and the hold refill step 6 tests
- A row under `## Needs a plan` carries no `Touches` column, so filing it unmeasured owes no file set and leaves the conflict check untouched
- A position claim in that cell names the row it outranks or the class it belongs to. Never justify a rank with a count of the defect's extent.
