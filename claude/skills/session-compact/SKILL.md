---
name: session-compact
description: Writes one handoff note to .canon/compact/ so the session after a compaction picks up where this one stopped. Use before running /compact, when asked to "write a handoff", "prepare for compaction", "save where we got to", or before moving a session to another machine, or when a PreCompact hook blocks and names this skill. Do NOT use for a session holding the orchestrator role, whose board handoff is `session-map`. Do NOT use to record a decision a groundwork track owns, which is `plan-groundwork`.
metadata:
  family: parallel
---

# Session compact

A compaction keeps conclusions and drops the reasoning behind them. This skill writes that reasoning to one file, outside the task board, before it is lost.

Write only what a compaction destroys. Git, the tree, and durable records are already safe, and restating them makes a handoff untrustworthy rather than long.

## Guards

- Write the note even when `git rev-parse --git-dir` does not resolve, since the filename comes from the work rather than the branch
- Decline in one line and write nothing when the session holds no reasoning git or a record would not show faster. A padded note is worse than none, because a reader trusts what they find.
- Resolve `.canon/` at the main worktree root and send the write out as a heredoc, both the way `session-worktree` states

## Step 1: write the note

Write one file to `.canon/compact/<slug>.md`, overwriting any note of the same name.

| Part     | Rule                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `<slug>` | Short kebab-case phrase for what the session did, not the branch, so work on `main` still gets a name. `latest` if none. |
| Sections | Follow `${CLAUDE_SKILL_DIR}/references/handoff-note.md`, read before drafting rather than worked from memory             |
| Count    | One note per piece of work. A second file for the same work splits the handoff.                                          |

## Step 2: report

```plaintext
✅ Handoff written: .canon/compact/<slug>.md
Move: canon records push, then canon sessions export <id>
```

- Print the `Move:` line only when the caller named moving the session to another machine
- Fill `<id>` from the `sessionId` of `canon sessions list --self --json`. Leave the literal `<id>` where that read refuses, since an id from any other row packs the wrong session.
- The push comes first so the note travels with the session
- Name both commands and run neither. An export packs a transcript that can hold credentials, so the order belongs to the caller.

A decline reports itself so a caller can tell it from a failure:

```plaintext
✅ No handoff. <what the session holds that git does not, and why it is nothing>
```

## Rules

- Cite a file, a commit, or a record for every claim. A handoff no reader can check is a story.
- Name what was decided together with what it beat. A decision with no rejected alternative reads as arbitrary and gets reopened.
- Write `## Where to pick up` as one instruction, not a menu. A reader who has to choose has not been handed off to.
- Leave the task board alone. A task is work somebody filed, and a handoff is context for one reader.
- Do not write a `## State` section, since `git status` and the log already hold it

## What this delegates

- The orchestrator's handoff, which carries a drift check and writes a task row: `canon:session-map`
- Reading a handoff back at the start of the next session: `canon:session-resume`
- Packing the session for another machine: `canon sessions export`, with `canon sessions import` and then `/canon:session-resume` on the arriving side
- A decision a groundwork track owns, which belongs in its own `06-decision.md`: `canon:plan-groundwork`
