---
name: session-resume
description: Why resuming reads the handoff before the board, reads an index before task files, resolves scratch at the main root, and never mutates what it reports
---

# Session resume requirement

## Gap

Without this skill, a session picking up old work rebuilds state from the git log, which records what shipped rather than what is queued. Reading every task file spends the context the work needs before it starts. A resume reading only the board walks past the handoff written to survive the compaction.

The task index catalogs the folder rather than filtering it, so its rows include the ordering file and every handoff. From a linked worktree the scratch folders resolve empty, which reads as no tracked work. A resume treated as cleanup offers to archive entries on a summary nobody confirmed.

## Must

- The newest handoff is read before the board and reported under its writer's name, its counts and sizes framed as true when written
- The handoff, plans, and tasks folders resolve at the main worktree root
- The index is read before any task file, its board siblings dropped, its order kept as the priority, and only the task files the summary needs opened
- The report closes on one recommendation naming the first item and whether a plan backs it, or what a handoff leaves open beside an empty board
- Every surface absent or empty reports no tracked work and stops

## Must not

- Read the whole tasks folder to build a summary
- Report that no handoff exists, which is the common case and trains a reader to skip the line
- Offer to remove, archive, or reorder an entry, since a resume reports and does not mutate
- Invent a next step from the repository when the board is empty

## Out of scope

- Writing a plain session's handoff, which `session-compact` owns
- Writing the board-side map, which `session-map` owns
- Marking an outcome or archiving a shipped task, which `task-complete` owns
