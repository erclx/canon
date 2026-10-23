---
title: Failure recovery
description: The step an operator resumes from after each auto-ship stop point, since every stop leaves the code on the branch and the plan linked
---

# Failure recovery

Every stop point leaves recoverable state. The user resumes manually from the appropriate step, named below for each stop point.

## Worktree entry

The first stop comes at Step 0, ahead of any plan read:

- Branch collision on worktree entry. `session-worktree` Step 5 found `<slug>` already as a local branch, so resolve manually (rename or delete the stale branch), then re-run autoship.

## Plan and task reads

The first plan read stops on a missing or misshapen file, and each repair differs:

- No plan (derived). Run `/plan-feature` to create one.
- No plan (caller-supplied). Check the path or slug passed to autoship, then re-run.
- No task (caller-supplied). Check the task path passed to autoship, then re-run.
- Task carries no `Plan:` line. Write the plan, point the task's `Plan:` line at it, then re-run.
- Resolved file carries no plan shape. Point autoship at a plan under `.canon/plans/feature-<slug>.md` or at a task under `.canon/tasks/`, then re-run.

A task's `Plan:` pointer can also fail after it is read:

- Task points at an archived plan. The work already shipped, so reopen the task against a live plan, or pass that plan's path directly.
- Task's `Plan:` pointer resolves to nothing. Repoint the task's `Plan:` line at the plan that exists, then re-run.

## Build and ship

These stops come after the plan reads:

- Verify fails. Read logs, fix manually, run `/git-ship`.
- git-ship fails. Inspect the hook or remote error, then run again.

## Draft mark and review wait

The last three stops sit after the pull request opens:

- Draft target is not this branch's. Nothing was marked, so read the number and `head=` from `git-pr`'s output, confirm they match, then run the mark by hand.
- Review wait timed out. The record went to the controller, so once the reviewers are dispatched, re-run `canon pr review-state <number> --wait 1200 --json` in the background.
- Review wait refused. Fix what the `reason` names, such as an unreadable remote, then re-run `canon pr review-state <number> --wait 1200 --json` in the background.
