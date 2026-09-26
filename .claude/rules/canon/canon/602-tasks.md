---
description: Scope, size, and link a task file correctly
---

# Tasks standards

## Task files

- Only create a task for work that spans multiple sessions or has real dependencies. Handle small edits immediately without a task entry.
- Do not add tasks retroactively for work already completed. Completed work is visible in git.
- When a task needs execution detail beyond its own file, write a plan in `.canon/plans/` in the same session as the task and link to it from the task's intro paragraph. The session that executes the plan later inherits reasoning context it would otherwise have to re-derive.
