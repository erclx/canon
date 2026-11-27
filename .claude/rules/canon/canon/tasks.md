---
description: Route edits under .canon/tasks/ to the task-create skill for task shape, the board, and a declined task, and keep a session handoff apart from a task
paths:
  - '.canon/tasks/**'
---

# Tasks standards

## Task files

- Load the `canon:task-create` skill before a hand edit under `.canon/tasks/`, since it carries the layout, filenames, format, origin lines, and archiving of a task file.
- Report it rather than proceeding silently when `canon:task-create` does not resolve.
- Follow the board shape the `canon:task-create` skill carries for `priority.md` and `backlog.md`, their readiness groups, and row order.
- Follow the decline shape the `canon:task-create` skill carries for a task decided against.

## Session handoffs

- Treat a `.canon/tasks/session-*.md` file as a handoff governed by the `canon:session-map` skill. It is not a task and carries neither `## Outcomes` nor `## Findings`.
