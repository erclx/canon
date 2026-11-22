---
title: Orchestrator kickoff
description: The order an orchestrator follows on a board holding no rows, the four standing preferences it asks the operator once, and where the answers land
---

Run this on an empty board, one with no `priority.md` rows, task files, plans, or open pull requests, being a new project's first orchestrator turn. Any other board never reads it. The order is a default the operator can reorder, since it came from one project's two-day kickoff.

# Orchestrator kickoff

## The order

1. Read the kickoff note at `.canon/tmp/kickoff/next-session.md` when `target-scaffold` left one.
   - Without a note, ask the operator where the plan behind the project lives, and file nothing before the answer.
2. Ask the four preferences below in one structured question, and record the answers before any launch.
3. File the first rows through `orchestrator-filing.md`, only on the operator's word.
4. Run groundwork on every row whose current state is unknown, before planning it.
5. Build design and the backend foundation in parallel, once their plans land.

## The preferences

Ask all four once, as one batch. Each question carries its default as the first option.

- Do builds wait on the operator's word before launch?
- Which model and effort does each plan weight take?
- Does groundwork stop at close for the operator's approval?
- Does a row's Launch cell fill when its plan links?

Two further preferences need no question. The pull after a merge follows `orchestrator-refill.md`, and a stopped planner's revival follows `orchestrator-planner-reuse.md`. Ask neither.

## Where the answers land

Write the answers into the `## Operator preferences` section of the session map, one line each, with no reasoning, per `${CLAUDE_SKILL_DIR}/../session-map/references/session.md`. A resumed orchestrator reads that section and asks none of them again.
