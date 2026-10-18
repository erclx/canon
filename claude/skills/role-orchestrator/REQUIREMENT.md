---
name: role-orchestrator
description: What the one warm control session owns, why it plans and dispatches review without building or merging, and the conflict test that holds a parallel build
---

# Role orchestrator requirement

## Gap

Without this skill, the control session builds or merges, and the cross-feature picture goes with it. Plans go out unread against each other and a moved tree, the queue empties or fills with whatever is oldest, a parked row's blocker is never re-tested, and a second orchestrator writes a board neither can read.

The channel fails at every hand-off. A finding or a reply stays in a thread nobody re-reads, a dispatch launches a branch other than the one the check cleared, a wave's cost grows unweighed, a report buries the human's decision, and a compaction loses the way back in.

## Must

- Every plan is verified against the current tree and names each in-flight track's file set, and a candidate holds only on a dependency, a contract, a relocation, a sweep, or a stated reason
- One planned, non-conflicting task stays in reserve, refilled while a wave builds, and every parked row's blocker is re-tested against the current tree with the result written to the board
- A finding or a reply lands on its owning surface, the pull request or the task, and a merged task's operator-only or cross-repository outcomes are struck with a reason and listed in the sweep
- A dispatch launches the cleared branch under a `worker-` name carrying its `sessionId`, hands review to `role-reviewer` once any named spend goes to the operator, and states the wave's cost
- A report and the pre-compact handoff lead with state, open decisions, and next action, the handoff carries its own resume invocation and poll restart, and every runbook ships inside the skill

## Must not

- Implement, edit any tracked file at any size, or merge
- Spawn a worker with the Agent tool, or hand a worker anything but a plan
- Run a second orchestrator against the same board
- Promote a row to fill the queue when nothing qualifies, or on how long it has waited
- Rewrite the board with a stream editor or a string replace that exits clean on no match

## Out of scope

- Writing the plan itself, which `plan-feature` owns
- Reviewing a worker's pull request, which `review-pr` and `role-reviewer` own
- Entering the worktree a build runs in, which `session-worktree` owns
- The worker's half of the channel and its boundaries, which `role-worker` owns
- Resuming a session with no board behind it, which `session-resume` owns
