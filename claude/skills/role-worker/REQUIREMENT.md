---
name: role-worker
description: What a building session is, the shared surfaces it may not write, and the two messages it owes the session that dispatched it
---

# Role worker requirement

## Gap

Without this skill, a building session is told what to do and never what it is. It writes shared surfaces, hand-writing the board from a stale copy, filing a task with no row, or re-drafting a readied pull request. From a linked worktree it finds no plan folder and reports the task has no plan.

The channel fails on the worker's side. A block opens a prompt nobody is attached to, a finished pull request goes idle unannounced, and a review wait stalls in silence. A late ask widens the scope both reviews already read, and a session told only to report upward never argues back with the evidence that corrects a wrong instruction.

## Must

- Session scratch resolves at the main worktree root, and a plan that fails to resolve is reported unreadable from there rather than absent
- The pull request announcement carries the number, the branch, the task, the reach, and any row the build turned up, and a fan-in member's done message carries its branch and head commit
- A block goes out as a message before it becomes a prompt, and a timed-out review wait sends the `canon pr review-state` record to the controller
- The plan's scope freezes at dispatch, and a late ask is sorted into a defect, a follow-up row, or an addition on the operator's word
- A refusal of an instruction the tree contradicts carries its evidence, and a talk launch puts its judgment calls to the operator in the session

## Must not

- Write the priority board or the backlog, at any size
- Create a task file for work the build turns up
- Ready the pull request directly, or re-draft one someone readied
- Report progress through the channel
- Restate a procedure `session-worktree`, `auto-ship`, or `review-address` carries

## Out of scope

- Entering the worktree, which `session-worktree` owns
- The chain from implement through pull request, which `auto-ship` owns
- Moving through the plan slice by slice, which `build-in-slices` owns
- Answering a posted review, which `review-address` owns
- The controlling session's half of the channel and the review poll, which `role-orchestrator` owns
