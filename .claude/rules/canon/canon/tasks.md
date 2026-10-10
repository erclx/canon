---
description: Route edits under .canon/tasks/ to the task-board skill for task shape, the board, and a declined task, and keep a session handoff apart from a task
paths:
  - '.canon/tasks/**'
---

# Tasks standards

## Task files

- Load the `canon:task-board` skill before a hand edit under `.canon/tasks/`. It carries the folder layout, filename convention, file format, origin lines, and archiving for a task file. Report it rather than proceeding silently when the skill does not resolve.
- Follow the board shape the `canon:task-board` skill carries for `priority.md` and `backlog.md`, their readiness groups, and row order.
- Never hand-edit `.canon/tasks/index.md`. A hook regenerates it from sibling frontmatter.
- Follow the decline shape the `canon:task-board` skill carries for a task decided against.

## Session handoffs

- Treat a `.canon/tasks/session-*.md` file as a handoff governed by the `canon:session-map` skill. It is not a task and carries neither `## Outcomes` nor `## Findings`.
