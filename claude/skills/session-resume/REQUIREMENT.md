---
name: session-resume
description: Why resuming reads the handoff before the board, reads an index before task files, resolves scratch at the main root, and never mutates what it reports
---

# Session resume requirement

## Gap

Without this skill, a session picking up old work reconstructs state from the git log, which records what shipped and not what is queued, so finished work reads as pending and the actual next item goes unmentioned. The alternative failure is worse for a different reason. A session that reads every task file and every plan to be thorough spends the context the work needs before the work starts, and the summary arrives in a session with no room left to act on it.

A compaction keeps conclusions and drops the reasoning that produced them, and the previous session can write that reasoning to a handoff before it goes. A resume that reads the board, the plans, and the memory index alone walks past that file, so the one artifact written to survive the compaction reaches nobody and the next session re-derives what it holds.

The task index is a folder catalog rather than a task filter, so it carries a row for the ordering file and one for every handoff on the board. A session reporting each row as a backlog item queues work nobody filed, and the count grows with every session that ever wrote a handoff.

From a linked worktree the shared scratch folders resolve against the worktree rather than the main root, where they are empty. That reports no tracked work on a repository carrying a full backlog, and the report is indistinguishable from the true empty case.

A resume is a read, and a session that treats it as a cleanup pass offers to archive finished entries or refresh a memory it decided was stale. Both change tracked state on the strength of a summary the user has not confirmed yet.

## Must

- Read the newest handoff before the board, and report what it carries attributed to its writer
- Resolve the handoff, plans, memory, and tasks folders at the main worktree root
- Read the task index before any individual task file, and open only the task files the summary needs
- Drop the board siblings from the index before reporting it as the backlog, since the catalog filters nothing and carries a row per handoff
- Preserve the index's order in the report, since the order is the priority
- Surface only the memory entries that inform the top item
- Close with one recommendation naming the first item and whether a plan backs it

## Must not

- Read the whole tasks folder to build a summary
- Report the absence of a handoff, which is the common case and would train a reader to skip the line on the run where one exists
- Restate a handoff's counts, sizes, or costs as current. Each was true when written.
- Offer to remove, archive, or reorder an entry. Resume reports and does not mutate.
- Update memory, which changes when a recorded fact becomes wrong rather than on a resume

## Guards

- All four surfaces absent or empty reports no tracked work and stops, rather than inventing a next step from the repository
- A handoff found beside an empty board recommends what the handoff leaves open, since the guard passes on the handoff alone and the recommendation has no backlog item to name

## Out of scope

- Writing a handoff, which happens at the close of a session rather than at its start. This skill names the standard that governs one and follows it no further.
- The sections a role adds over the core handoff, which belong to that role's own surface
- Archiving a shipped task out of the folder: `task-board`
- Archiving a plan and marking an outcome, which `context-fold` does when the work ships
- Implementing the item it recommends, which is the next request rather than part of this one
