---
name: session-compact
description: Captures a session's memory, then writes one handoff note to .canon/compact/ so the session after a compaction picks up where this one stopped. Use before running /compact, when asked to "write a handoff", "prepare for compaction", "save where we got to", or when a PreCompact hook blocks and names this skill. Do NOT use for a session holding the orchestrator role, whose board handoff is `session-map`. Do NOT use to record a decision a groundwork track owns, which is `plan-groundwork`.
---

# Session compact

A compaction keeps conclusions and drops the reasoning that produced them. This writes the reasoning down first, in one file, outside the task board.

Write only what a compaction destroys. Everything a later session can read from git, from the tree, or from a durable record is already safe, and restating it is what makes a handoff untrustworthy rather than long.

## Guards

- If `git rev-parse --git-dir` does not resolve, the note still writes. The filename comes from the work rather than from the branch, so nothing here needs a repository.
- Decline where the session holds no reasoning a reader could not get faster from git or from a record already written. Say so in one line and write nothing. A padded note is worse than an absent one, because a reader who finds a note trusts it.
- Resolve `.canon/` at the main worktree root, the way `session-worktree` does. From a linked worktree the file-editing tools refuse that path, so the write goes out through `Bash` as one plain command carrying a heredoc.

## Step 1: capture memory

Invoke `canon:memory-capture` and let it return before writing. The note then cites what was written rather than restating the same lesson in prose.

State the caveat the caller gives about committing. A caller that does not commit says so, and capture skips routing and writes memory files alone.

Carry through the line capture returns when a fact routed, so the session knows a fold is still owed. Report nothing else about what it wrote.

## Step 2: write the note

Write one file to `.canon/compact/<slug>.md`. Name `<slug>` for the work as a short kebab-case phrase, taken from what the session did rather than from the branch, so a session that ran on `main` still gets a name a reader recognizes. Use `latest` when nothing in the session names the work.

Follow `${CLAUDE_SKILL_DIR}/references/handoff-note.md` for what each section carries and what stays out. Read it before drafting rather than working the shape from memory.

Overwrite a note of the same name. One session's work has one note, and a second file for the same work splits the handoff.

## Step 3: report

```plaintext
✅ Handoff written: .canon/compact/<slug>.md
<the line memory-capture returned, where a fact routed>
```

A decline reports itself so a caller can tell it from a failure:

```plaintext
✅ No handoff. <what the session holds that git does not, and why it is nothing>
```

## Rules

- Cite a file, a commit, or a record for every claim. A handoff no reader can check is a story.
- Name what was decided together with what it beat. A decision with no rejected alternative reads as arbitrary and gets reopened.
- Write `## Where to pick up` as one instruction, not a menu. A reader who has to choose has not been handed off to.
- Leave the task board alone. A task is work somebody filed, and a handoff is context for one reader.
- Do not write a `## State` section. A session that committed nothing has no state a reader could not get from `git status` faster, and one that did has it in the log.

## What this delegates

- The memory pass, its routing, and the pen's shape: `canon:memory-capture`
- The orchestrator's handoff, which carries a drift check and writes a task row: `canon:session-map`
- Reading a handoff back at the start of the next session: `canon:session-resume`
- A decision a groundwork track owns, which belongs in its own `06-decision.md`: `canon:plan-groundwork`
