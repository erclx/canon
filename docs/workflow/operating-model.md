---
title: Operating model
description: Orchestrator, planner, and worker roles for building across parallel sessions
category: Workflow
---

# Operating model

One warm session holds the cross-feature call and reviews. Cold worker sessions build, and the human launches workers and merges. For merge order see [Parallel features](parallel-features.md), and for worktree gotchas see [Claude Code and git worktrees](../../wiki/claude/worktrees.md).

## Four roles

| Role         | Session                                    | Owns                                                                                     | Does not                                                 |
| ------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Orchestrator | One warm, long-lived session               | The cross-feature call, review dispatch, merge order                                     | Review in place, edit, merge without the operator's word |
| Reviewer     | One cold session per PR or small batch     | Each PR's read through `review-pr`, the lift on close                                    | Fix findings, ready by hand, merge                       |
| Planner      | One session per row or batch, warm or cold | Measure each row against the tree, write one plan per row, run a drive or a sketch round | Enter a worktree, write the board, land a design pick    |
| Worker       | One cold worktree session per feature      | Implement, self-check, open PR, answer the reviewer                                      | Write the shared board, merge                            |

Each role keeps to its own writes, and five rules cover how the roles meet.

- The orchestrator loads `role-orchestrator`, a worker loads `role-worker` through `auto-ship` Step 0, and a planner and a reviewer load theirs from the launch that dispatches them
- The orchestrator decides which rows conflict, what merges first, and whether a row runs. Per-row planning can go cold, and a row a groundwork track or app drive measured returns to that session.
- A dispatched planner writes only the plan, and reports what the task file got wrong rather than repairing it
- A worker that halts on a plan question, or argues back against an instruction the tree contradicts, is working correctly
- The orchestrator edits no tracked file. File a row with the defect and the surface, with no count or cause.

## The loop

1. Plan the next feature with `plan-change` into `.canon/plans/`. Run it warm when the row turns on a contract other rows consume, and dispatch a planner otherwise.
2. Check the plan waits on nobody, the branch is unclaimed, and no track in flight conflicts. Dispatch a background worker with `claude --bg`, naming the branch, the model, and the effort.
3. The worker enters its own worktree, builds, self-checks, opens a PR, and stops there.
4. The orchestrator reads `canon pr evidence --check` and sends a painted PR with no evidence comment back to its worker. The code reviewer waives an uncaptured path or files a finding on it.
5. Dispatch a reviewer under `role-reviewer` for every PR but a release one, or one pair per batch of small contract-free PRs. It posts `review-pr` findings, and `review-ui` drives any non-taste box.
   - A PR an `OVERLAP` line names takes its UI pass and reel once it is next to merge
6. The reviewer tells the session holding the branch to run `review-address`, found with `canon sessions list --branch`, once a pass posts a finding at any severity.
7. The worker addresses the findings, rebases onto `origin/main` if a sibling touched its files, and pushes. It asks each reviewer `canon pr review-state` reads behind the head to re-review, ahead of CI.
8. A pass posts `## Review` while anything is open and `## Review closed` when nothing is. The reviewer then runs `canon pr lift`.
9. The operator runs `canon pr merge <number>` or names the PR for the orchestrator to merge.
   - Each trailing worker the merge touched rebases on the wake of its `canon pr review-state --wait-standing`, and the orchestrator hands the rebase only to a branch whose worker is gone
   - A standing authorization, scoped by default to the PRs in flight when the operator gives it, lets the orchestrator merge each as its gates pass and report after
   - The verb refuses `standing-stale`, naming the files, when a sibling changed one the PR writes or its examples stamp since the fork point. The branch updates and reruns CI before it retries.
     - On a release-please branch, no worker owns the update, so the refusal names `gh pr update-branch <number>` as the step to run
   - The verb then fast-forwards the main worktree it ran from, so the `post-merge` hook runs, unless `--no-pull` is passed

Each worker halts at the PR, and the merge stays a human gate. An agent merges only on the operator's word, for a named PR or under a standing authorization. The verb squashes with the body's Summary, Key changes, and Technical context as the message. A release-please or Dependabot pull request merges the same way, from the bot's own body.

An orchestrator can run this loop unattended, from now or from a set time. Every local `claude --bg` launch but a talk one denies the question tool, so a session messages its controller and waits. The run answers technical questions, parks the operator's, merges only what the operator granted before leaving, and reports each merge and what is left.

### The attended run

An attended run keeps the queue moving while the operator stays and merges. It starts and stops on the operator's word, launches each row once the rows it depends on have merged, and plans one cap's worth of rows ahead, holding on a billed run, a refused command, or a question meant for the operator.

## The review layer

The first review a change gets is a dispatched reviewer's. The worker's gate inside `auto-ship` decides whether the PR opens, and the draft mark holds the merge. The reviewer pass is the merge gate.

`canon pr key-changes` flags a Key changes claim the diff does not carry. See `canon pr key-changes --help`.

## The review channel

Findings travel on the PR. `review-pr` posts them, `review-address` fixes them and pushes, and `review-pr` runs again on the added commits.

- `canon pr head` resolves the tip a pass scopes against, and `canon pr checks` reports the runs and commit statuses for it. See `canon pr head --help`.
- A worker messages its controller when the PR opens with any row it turned up, when each address pass pushes with CI still running, and on a block, then ends its turn. It sends nothing on progress.
- A declined finding carries the fact that settled it in its reply body, and a minor goes to the findings of the task the branch closes
- A finding answered without a commit still owes a close-out, read from the worker's response
- A branch `main` moved under is the worker's to rebase, in the same force-push as the fixes

## Feature sizing

One feature is one plan, one worktree, one PR, one review sitting. Split a feature when a backend contract and its consumer both change, landing the contract first. Make a few-line change an ordinary edit.

A row whose plan touches 5 files or fewer, not graded heavy, goes to one session that plans and builds it through `auto-ship --plan-first`. A question needing the operator's call holds that session on a bounded wait, and review stays a separate session.

## Where work comes from

Tasks in `.canon/tasks/` hold the active few, one file each. `priority.md` carries execution order and `backlog.md` carries what nobody schedules.

## Parallelism

Stop adding worker tracks once you cannot review every output. A row waits only on a conflict a merge cannot settle, as the `role-orchestrator` runbook states. A shared file is not one, and the branch merging second resolves it. See [Fowler](https://martinfowler.com/articles/branching-patterns.html) and [DORA](https://dora.dev/capabilities/trunk-based-development/).

- The orchestrator keeps one cross-branch pass per wave
- Checks, dev servers, and screenshots run in many worktrees at once, each on its own port, while singleton resources serialize

## Related

- [Claude Code and git worktrees](../../wiki/claude/worktrees.md) for the mechanism and port collisions
- [Claude Code subagents](../../wiki/claude/subagents.md) for in-session parallelism, and [blocking subagents](../../wiki/claude/permissions.md#blocking-subagents) for the `permissions.deny` rule
- [Plan to merge](plan-to-merge.md) for one row followed from filing to merge
- [AI workflow](ai-workflow.md) for which path to pick for your own work
- [Skill map](skill-map.md) for how the skills in the loop are categorized
