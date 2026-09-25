---
name: session-compact
description: Why a plain session needs a handoff surface that is not the task board
---

# Session compact requirement

## Gap

Without this skill, a session facing a compaction reaches for `session-map`, which writes `.canon/tasks/session-<slug>.md`. The board carries four such files today, and `session-resume` drops them by name prefix to read the real rows, so a reader works around a misplacement on every run.

`session-map` also carries the orchestrator's shape: a drift check against a start commit nothing records, a step for role sections, and a `## State` section. A session that shipped nothing pays all three to leave one note behind, and `standards/session.md` already names a `## State` filled from the tree as non-conforming, which is the failure that shape invites.

Sessions also write the wrong thing into a handoff. They restate the tree, which survives a compaction, and omit what each decision beat, which does not.

## Must

- Write to `.canon/compact/`, outside the task board and outside scratch.
- Invoke `canon:memory-capture` before writing, so the note cites entries rather than repeating them.
- Carry a stated shape for the note, so what belongs in it is not re-derived per session.
- Require a citation for every claim, and a rejected alternative beside every decision.
- Decline in one line where the session holds nothing a compaction would destroy.
- Name `canon records push` then `canon sessions export` in the report when the caller asked to move the session to another machine, since this is the step a session takes before it moves and no other skill names either verb.

## Must not

- Write a task row, a plan, or anything under `.canon/tasks/`.
- Write a `## State` section, or any section a reader could fill from `git status`.
- Run a drift check or recover a start commit. Both belong to the role that ships code.
- Restate a memory entry the capture pass wrote.
- Lose its caller. The `PreCompact` hook names this skill on a manual compaction, and that hook plus an operator typing it are the two callers the third creation question asks for. A hook edit that names another skill leaves one caller, which is a reason to revisit this skill rather than to keep it.

## Guards

- No repository is required. The slug comes from the work, so a session outside git still writes a note.
- `.canon/` resolves at the main worktree root. From a linked worktree the write goes through the shell, since the file-editing tools refuse that path.
- Decline rather than pad. A note a reader finds is a note a reader trusts.
- The note is backed up by `canon records push`, which carries every top-level `.canon/` folder, and the push is a run someone makes. Until it runs, or where no remote is configured, the note sits on one disk. The skill's report does not say so on an ordinary note, since it would restate a run the operator owns on every note. A caller who named a move is the exception, because the push is then the step the move depends on rather than a reminder, and the line prints on that report alone.

## Out of scope

- The orchestrator's handoff, which carries a drift check and a board row: `canon:session-map`. The two skills are held apart by role, so a plain session belongs here and a session holding `canon:role-orchestrator` belongs there.
- Reading a handoff back: `canon:session-resume`, which reads `.canon/compact/` ahead of the older task-board form.
- The memory pen, its routing and its shape: `canon:memory-capture` and `standards/memory.md`.
- A decision a groundwork track owns, which belongs in that track's `06-decision.md`: `canon:plan-groundwork`.
