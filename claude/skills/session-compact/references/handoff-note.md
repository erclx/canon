---
title: Handoff note
description: What each section of a compact handoff carries, what stays out, and the test every line passes
---

# Handoff note

The shape `session-compact` writes. It lives here rather than in `standards/` because one skill reads it and a standard nothing else cites has no second reader to correct it.

## The test every line passes

Would a compaction destroy this, and can no other artifact give it back?

A line failing either half comes out. The tree, the git log, a groundwork record and the task board all survive a compaction, so restating any of them spends the reader's trust on something they already had.

## Frontmatter

```markdown
---
title: <what the session settled, as a sentence>
description: <what it decided, what it measured, what it left open, and the date>
category: Compact
---
```

## The sections

### The opening line

One sentence naming this as throwaway and pointing at whatever durable record holds the detail. A reader who knows the note is disposable reads it differently from one who thinks it is the record.

### `## Where the work is`

The paths, and how to run what is there. A later session's first cost is finding the thing, and a wrong guess about which folder is current wastes more than this section costs.

Name what was not touched too. A session that changed no source says so, since a reader otherwise opens `git status` expecting a diff.

### `## What was decided`

One bullet per decision, each naming what it beat. A decision with no rejected alternative reads as arbitrary and gets reopened by the next session that dislikes it.

Where a decision rests on a measurement, give the number rather than the conclusion. `27 spacing values became 7` survives a reader disagreeing with it, where `the spacing was tidied` does not.

### `## What is open`

Numbered, because a reader picks one. Each carries what is unresolved and what would settle it.

A thing deliberately not done belongs here, marked as such. An open question and a declined option look identical to a later session unless the note separates them.

### `## Where to pick up`

One instruction. Not a list, not a menu, not a recommendation with alternatives.

Where the next move is a measurement rather than a decision, say so, since a session handed an open question reaches for a pick by default and spends a round on a question nobody needed answered.

### `## Cautions`

Only what cost this session time and would cost the next one the same. A command whose output goes to stderr, a tool reading something other than what its name suggests, a generator that deletes more than it wrote.

Not general advice. A caution a reader could have guessed is noise around the two that matter.

## What stays out

- A `## State` section. A session that committed nothing has no state, and one that did has it in the log.
- The tree, the file counts, and the folder listing. All survive a compaction.
- The session's narrative. What was tried and abandoned belongs in the record the track keeps, or in memory if it generalizes, or nowhere.
- A lesson already written to `.canon/memory/`. Cite the entry by name rather than restating it.
- Anything the reader would have to take on trust. Every claim carries a file, a commit, or a record.
