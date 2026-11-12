---
name: session-resume
description: Resumes a session by reading the handoff note it wrote before compacting, matched by its own session id, and closing on that note's "Where to pick up" line. Use when starting after a compaction, or when asked to "pick up where we left off", "what was I working on", or "resume". Do NOT use for the task board, which is `canon tasks list`, or for an orchestrator, whose resume is its own.
metadata:
  family: parallel
---

# Session resume

This skill hands a session its own note back. It reads no board, no session map, and no plan, since a board that is never empty steers every resumed session off its own work.

## Step 1: find this session's note

Resolve `.canon/compact/` at the main worktree root the way `session-worktree` does.

- A call naming a note, such as `my-slug`, reads `.canon/compact/my-slug.md` whatever its `session` field holds, since an imported session has a new id
- A call naming nothing reads the note whose `session` frontmatter field equals the `sessionId` of `canon sessions list --self --json`, the newest when several match

Read the id before the notes. When `--self` refuses, treat the session as matching no note rather than reading the newest.

When a named note is absent from the folder, report it missing and point at `canon records pull`, since an imported session receives its notes through the records repository. Then take the path below, never the newest note.

### When nothing matches

Never fall back to the newest note, since a note another session wrote is the wrong handoff. A note written before the `session` field existed matches nothing here.

- List the three newest notes by `title` and `description`, and ask which one is this session's. Offer none as an answer.
- Stop with `✅ No handoff found. Start a new task.` when `.canon/compact/` is absent or holds no note.

## Step 2: report

Output the note's reasoning under **Carried over**, attributed to the note rather than stated as fact. Re-measure any count or size it quotes before acting on it.

Say nothing about a surface this skill did not read.

## Step 3: close

End with one line reading `Start with: <the note's "Where to pick up" instruction>`.

Add one more line for a reader who wanted the board, reading `The board is one verb away, canon tasks list. An orchestrator resumes through its own reference.`

### Leave entries alone

Do not offer to remove, archive, or reorder a note or an entry. The git log is the record of shipped work, and a resume reports without mutating.

## Writing the next one

This skill reads a handoff and never writes one, since the write happens at the close of a session rather than at its start.

- Route a session asking how to leave a handoff to `session-compact`, which writes a note under `.canon/compact/` carrying the session's id
- A session holding the orchestrator role takes `session-map`, which writes the board-side map the standard governs
