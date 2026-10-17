---
name: session-resume
description: Resumes a previous session by reading the handoff it left behind, tracked work, and relevant context. Use when starting a new session, or when asked to "pick up where we left off", "what was I working on", or "resume".
metadata:
  family: parallel
---

# Session resume

## Step 1: read tracked work

Resolve `.canon/plans/`, `.canon/compact/`, and `.canon/tasks/` at the main worktree root the way `session-worktree` does.

Read these in parallel, skipping any that do not exist:

- The newest `.canon/compact/*.md`, which is the note `session-compact` writes before a compaction
- The newest `.canon/tasks/session-*.md`, the board-side map per `${CLAUDE_SKILL_DIR}/../session-map/references/session.md`. Whichever handoff exists leads the report, and both lead it when both exist.
- `.canon/tasks/index.md`, the folder catalog, read before any task file. Drop its `index`, `priority`, `backlog`, and `session-` rows, which are siblings rather than tasks.
- `.canon/plans/*.md`: execution detail for in-progress tasks

Then read only the task files the summary needs, typically the top one, never the whole folder. Say nothing about an absent handoff, since a line reporting it every run trains a reader to skip it on the run where one exists.

### Nothing tracked

If the handoff, task, and plan surfaces are all absent or empty, stop: `✅ No tracked work found. Start a new task.`

## Step 2: summarize

Output these sections, omitting the first when no handoff was found:

| Section          | Holds                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| **Carried over** | The handoff's reasoning, attributed to it rather than stated as fact. Re-measure any count before acting.  |
| **Up next**      | One line per task row in `.canon/tasks/index.md`, in order. Session rows are not tasks, so leave them out. |
| **Active plans** | One line per file in `.canon/plans/`, linked to its task file in `.canon/tasks/`. "None" if empty.         |

## Step 3: recommend

End with one line: `Start with: <first Up next item>` and note whether it has a linked plan.

When the board is empty and a handoff was found, name what it leaves open instead: `Start with: <the open thread the handoff names>`. An empty recommendation reads as a failed run, and a handoff on an empty board is what a reasoning session leaves.

### Leave entries alone

Do not offer to remove entries. A completed task is archived out of `.canon/tasks/` when work ships, and the git log is the record of shipped work. Plan files archive per `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan-lifecycle.md`.

## Writing the next one

This skill reads a handoff and never writes one, since the write happens at the close of a session rather than at its start.

- Route a session asking how to leave a handoff to `session-compact`, which writes a note under `.canon/compact/`
- A session holding the orchestrator role takes `session-map`, which writes the board-side map the standard governs
- A role carrying sections of its own adds them over the core per that role's own runbook
