---
description: Route .canon/tasks/ edits to the tasks standard for task files and the board standard for priority.md and backlog.md
paths:
  - '.canon/tasks/**'
---

# Tasks standards

## Authority

- Follow the tasks standard for filenames, frontmatter, what belongs, and the task file format. It is the single source. Read it with `canon standards tasks`.
- Follow the board standard for `priority.md` and `backlog.md`, their readiness groups, and row order. Read it with `canon standards board`.
- Never hand-edit `.canon/tasks/index.md`. A hook regenerates it from sibling frontmatter.
