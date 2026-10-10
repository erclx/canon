---
title: Failure recovery
description: The step an operator resumes from after each auto-ship stop point, since every stop leaves the code on the branch and the plan linked
---

# Failure recovery

Every stop point leaves recoverable state. The user resumes manually from the appropriate step.

| Stop point                                 | Recovery                                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| No plan (derived)                          | Run `/plan-feature` to create one                                                                                                               |
| No plan (caller-supplied)                  | Check the path or slug passed to autoship, then re-run                                                                                          |
| No task (caller-supplied)                  | Check the task path passed to autoship, then re-run                                                                                             |
| Task carries no `Plan:` line               | Write the plan, point the task's `Plan:` line at it, then re-run                                                                                |
| Task points at an archived plan            | The work already shipped. Reopen the task against a live plan, or pass that plan's path directly.                                               |
| Task's `Plan:` pointer resolves to nothing | Repoint the task's `Plan:` line at the plan that exists, then re-run                                                                            |
| Resolved file carries no plan shape        | Point autoship at a plan under `.canon/plans/feature-<slug>.md` or at a task under `.canon/tasks/`, then re-run                                 |
| Branch collision on worktree entry         | `session-worktree` Step 5 found `<slug>` already as a local branch. Resolve manually (rename or delete the stale branch), then re-run autoship. |
| Verify fails                               | Read logs, fix manually, run `/git-ship`                                                                                                        |
| git-ship fails                             | Inspect hook or remote error, run again                                                                                                         |
| Draft target is not this branch's          | Nothing was marked. Read the number and `head=` from `git-pr`'s output, confirm they match, then run the mark by hand                           |
