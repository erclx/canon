---
name: task-board
description: Why creating and declining a task file is one skill, the origin invariant enforceable only at creation, and why settling a shipped task belongs elsewhere
---

# Task board requirement

## Gap

Without this skill, a task file gets a filename and frontmatter invented on the spot, so the board sorts wrong and the index reads fields that are not there. A task with no origin is lost context or work nobody decided on, and nothing recovers which. A label picked by hand repeats one the archive spent.

Two sessions filing at once claim one label twice or land rows beside each other unread. A worker filing what its build turned up writes a row the controlling session never placed, and a decline forced around a refusal leaves the board disagreeing with its own verbs.

## Must

- The board resolves at the main worktree root, and the filename and frontmatter come from the tasks standard rather than memory
- Every created task carries an origin, since creation is the only moment the invariant is enforceable
- The phase label is claimed through `canon tasks next-label --claim`
- A live orchestrator on the roster receives the row as a handoff rather than as a write beside it
- A decline runs through its verb and routes on the reason it refuses

## Must not

- Mark an outcome, archive a task, move a plan, or hand-edit the index or the ordering file
- Write a pull request line at creation, when any number is a guess at someone else's work
- Decline around a refusal
- Claim a label or write a task file for a session holding the worker or planner role, which reports the row upward instead
- Pick between creating and declining when the request fits neither, or create a task with no origin given

## Out of scope

- Marking a shipped task's outcomes and archiving it, which `task-complete` owns
- Relocating a plan, which `canon tasks archive` owns
- What a task argues, which its author owns, since this skill owns the file's existence and shape
