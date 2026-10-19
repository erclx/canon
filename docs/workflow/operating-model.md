---
title: Operating model
description: Orchestrator, planner, and worker roles for building across parallel sessions
category: Workflow
---

# Operating model

One warm session holds the cross-feature call and reviews. Cold worker sessions build, and the human launches workers and merges. For merge order see [Parallel features](parallel-features.md), and for worktree gotchas see [Claude Code and git worktrees](../../wiki/claude/worktrees.md).

## Four roles

| Role         | Session                               | Owns                                                 | Does not                           |
| ------------ | ------------------------------------- | ---------------------------------------------------- | ---------------------------------- |
| Orchestrator | One warm, long-lived session          | The cross-feature call, review dispatch, merge order | Review in place, edit, merge PRs   |
| Reviewer     | One cold session per pull request     | One PR's read through `review-pr`, the lift on close | Fix findings, ready by hand, merge |
| Planner      | One session per row, warm or cold     | Measure the row against the tree, write one plan     | Enter a worktree, write the board  |
| Worker       | One cold worktree session per feature | Implement, self-check, open PR, answer the reviewer  | Write the shared board, merge      |

- The orchestrator loads `role-orchestrator`, a worker loads `role-worker` through `auto-ship` Step 0, and a planner and a reviewer load theirs from the launch that dispatches them
- The orchestrator decides which rows conflict, what merges first, and whether a row runs at all. Per-row planning can go cold.
- A dispatched planner writes only the plan, and reports what the task file got wrong rather than repairing it
- A worker that halts on a plan question, or argues back against an instruction the tree contradicts, is working correctly
- The orchestrator edits no tracked file. File a row with the defect and the surface, with no count or cause.

## The loop

1. Plan the next feature with `plan-feature` into `.canon/plans/`. Run it warm when the row turns on a contract other rows consume, and dispatch a planner otherwise.
2. Check the plan waits on nobody, the branch is unclaimed, and no track in flight conflicts. Dispatch a background worker with `claude --bg`, naming the branch and the model.
3. The worker enters its own worktree, builds, self-checks, opens a PR, and stops there.
4. Dispatch a reviewer under `role-reviewer` for every PR but a release one. It posts `review-pr` findings, and `review-ui` drives any visual checklist.
5. The reviewer tells the session holding the branch to run `review-address`, found with `canon sessions list --branch`, once a pass posts a finding at any severity.
6. The worker addresses the findings, rebases onto `origin/main` if a sibling landed on its files, pushes, and asks that reviewer for a re-review of the added commits.
7. A pass posts `## Review` while anything is open and `## Review closed` when nothing is. The reviewer then runs `canon pr lift`.
8. The human merges with `canon pr merge <number>`. The orchestrator tells any trailing worker whose files the merge touched to run `review-address`, which rebases.

Each worker halts at the PR, and the merge stays a human gate. `canon pr merge` squashes with the body's Summary, Key changes, and Technical context as the message, and a deny rule keeps every agent off it. The merge button stays for a pull request a bot opens, such as a dependency bump or a release, whose body carries none of those sections.

## The review layer

The first review a change gets is a dispatched reviewer's. The worker's gate inside `auto-ship` decides whether the PR opens, and the draft mark holds the merge. The reviewer pass is the merge gate.

`canon pr key-changes` flags a Key changes claim the diff does not carry. See `canon pr key-changes --help`.

## The review channel

Findings travel on the PR. `review-pr` posts them, `review-address` fixes them and pushes, and `review-pr` runs again on the added commits.

- `canon pr head` resolves the tip a pass scopes against, and `canon pr checks` reports the runs for it. See `canon pr head --help`.
- A worker messages its controller when the PR opens with any row it turned up, when each address pass ends with the CI state, and before a block becomes a prompt. It sends nothing on progress.
- A declined finding carries the fact that settled it in its reply body, and a minor goes to the findings of the task the branch closes
- A finding answered without a commit still owes a close-out, read from the worker's response
- A branch `main` moved under is the worker's to rebase, in the same force-push as the fixes

## Feature sizing

One feature is one plan, one worktree, one PR, one review sitting. Split a feature when a backend contract and its consumer both change, landing the contract first. Make a few-line change an ordinary edit.

## Where work comes from

Tasks in `.canon/tasks/` hold the active few, one file each. `priority.md` carries execution order and `backlog.md` carries what nobody schedules.

## Parallelism

Stop adding worker tracks once you cannot review every output. A row waits only on a conflict a merge cannot settle, as the `role-orchestrator` runbook states. A shared file is not one, and the branch merging second resolves it. See [Fowler](https://martinfowler.com/articles/branching-patterns.html) and [DORA](https://dora.dev/capabilities/trunk-based-development/).

- The orchestrator keeps one cross-branch pass per wave
- Checks, dev servers, and screenshots run in many worktrees at once, each on its own port, while singleton resources serialize

## Related

- [Claude Code and git worktrees](../../wiki/claude/worktrees.md) for the mechanism and port collisions
- [Claude Code subagents](../../wiki/claude/subagents.md) for in-session parallelism, and [blocking subagents](../../wiki/claude/permissions.md#blocking-subagents) for the `permissions.deny` rule
- [Skill map](skill-map.md) for how the skills in the loop are categorized
