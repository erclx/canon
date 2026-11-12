---
name: session-resume
description: Why a resume reads the session's own note by id and never the board, falls back to a question rather than the newest note, and never mutates what it reports
---

# Session resume requirement

## Gap

Without this skill, a session picking up old work rebuilds state from the git log, which records what shipped rather than what was in flight. A resume reading the newest note from any session, then the board and every plan, steers a resumed session off its own work, since a board is rarely empty and its first row is not this session's.

The note a compaction leaves is the only record of the session's reasoning. A resume that matches it by anything but the session's own id reads another session's handoff as if it were this one's.

## Must

- The note read is the one whose `session` field equals the resuming session's own id, or the one a call names, read even when its id differs
- The `Carried over` section attributes the note's reasoning to it, with its counts and sizes framed as true when written
- The handoff folder resolves at the main worktree root
- A session matching no note lists the three newest by title and asks, or reports no handoff when none exists
- The report closes on the note's `Where to pick up` line and one line naming `canon tasks list` for a reader who wanted the board

## Must not

- Read the task board, the session map, or any plan to build the report
- Fall back to the newest note when none matches this session
- Report a surface it did not read, or that no handoff exists when the folder holds notes
- Offer to remove, archive, or reorder an entry, since a resume reports and does not mutate
- Invent a next step from the repository when the note names none

## Out of scope

- Writing a plain session's handoff and its `session` field, which `session-compact` owns
- Writing or reading the board-side map, which `session-map` and the orchestrator's own resume own
- Marking an outcome or archiving a shipped task, which `task-complete` owns
