---
title: Session map reference
description: Filename and location, the sections a handoff carries, the write and read procedures, and how a role extends it
---

# Session map reference

Applies to `.canon/tasks/session-<slug>.md`. A session writes one before a compaction, because a compaction keeps conclusions and drops the reasoning that produced them.

- Rewrite it whenever its owner learns something the next session would otherwise re-derive
- It is optional, and a project whose sessions never approach a compaction carries none
- Any session writes one. The role a session holds decides which sections it adds over the core, never whether it may write.

## Contents

- [Scope](#scope)
- [What a working session map looks like](#what-a-working-session-map-looks-like)
- [Filename and location](#filename-and-location)
- [Frontmatter](#frontmatter)
- [Sections](#sections)
- [Length](#length)
- [Writing one](#writing-one)
- [Reading one back](#reading-one-back)
- [Extending it](#extending-it)
- [Template](#template)

## Scope

Governs the pre-compaction handoff at `.canon/tasks/session-<slug>.md`: its filename, its sections, what a writer puts in each, and how a reader picks one up.

Does not govern:

- The task board the file sits beside, its filenames, and its archiving: `tasks.md`
- The transform from a branch name to the slug in the filename: `slug.md`
- The role-specific sections a caller adds over the core, which belong to that caller
- The note a plain session writes at `.canon/compact/<slug>.md`, whose shape lives in the `session-compact` skill's own reference

## What a working session map looks like

A session map works when the session reading it can act on the reasoning without asking the session that wrote it:

- What is clean, what is running, and what is open right now?
- Which mistake already made would this session repeat?
- Which command, tool, or held instruction lies about the tree?
- Where did each claim come from, so a reader can tell a read from a recall?

A session map failing these is non-conforming even when it satisfies every shape rule below.

## Filename and location

- Write one file per session, named `session-<slug>.md`, where `<slug>` is the branch-derived slug
- Fall back to `session-latest.md` when the branch resolves empty, since a handoff is scratch rather than a commit and a stop would lose the reasoning it exists to save
- Resolve the containing folder at the main worktree root, never inside a linked worktree
- Overwrite the file the writing session already owns. A stale entry read as current is worse than no handoff.
- Never write into a file another session owns. One file per session is what keeps two sessions closing near each other from each writing the whole file, where the loser leaves no trace.

## Frontmatter

- `title` (required): `Session map`, so every handoff reads the same in a generated catalog
- `description` (required): what the board cannot show, and the date the file was written

## Sections

Three sections form the core, in this order, and every session fills all three.

- `## State`: what is clean, what is running, what is open, and any untracked file that needs committing
- `## Mistakes worth not repeating`: one line per mistake, written as the habit it yields
- `## Standing cautions`: commands that lie, tools that measure the wrong tree, and anything unbacked

Add a section only for content that fits none of the three and would otherwise be lost. Every section holds to the six criteria under `### Structure` in `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md`.

## Length

A map holds at most 350 words, so the session resuming from it reads it in about a minute.

- The count covers the body below the title. Frontmatter, the title line, and a `## Resume` section a role closes the file with stay out of it.
- `canon records validate sessions` reports each map's count against the cap and never fails the run, since a write refused near a compaction loses the reasoning the map exists to hold
- A map over the cap is cut at its next rewrite, starting with whatever another artifact already carries

## Writing one

The `session-map` skill is the invocable route onto this procedure and holds no role, so a session reaching for a handoff without knowing this document exists still lands here. A session that arrives at this document directly follows the steps below unchanged.

1. Run `canon claude skills drift <the commit this session started from>` and record what it names under `## Standing cautions`, in one line when it refuses.
2. Recover that commit with `git log -1 --format=%H --before='<duration> ago'`, rounding the session's running time up rather than down.
3. Write only what a compaction destroys and no other artifact already carries. The board holds the ordering, a task file its findings, and a measurement folder its track.
4. Cite a commit, a task, or a file and line for every claim about the tree, so the next session can tell a read from a recall. A rule or a habit carries no citation.
5. Fill a section from reasoning the session holds, starting from the board and the live roster `canon sessions list` reads rather than from the prior map.
6. Run `canon records validate sessions session-<slug>` and report the count it names against the cap.

Do not restate the board, and do not summarize the work that shipped, since version control already carries it.

### Why the drift step

A skill body enters a session once, and re-invoking the skill does not re-read the file. Drift is worst at this moment, so a name here is a body the session followed out of date.

- Recording a name is not acting on it, and the verb misses a body this session edited and has not committed
- The step belongs to session length rather than any role, so every writer runs it. A refusal names the boundary of what the verb can read rather than a fault.
- One line holds a refusal, naming the boundary it reported. Every consumer repository refuses, so a paragraph explaining why repeats the same words in every map.

### Recovering the start commit

Nothing on the machine records the start commit. A ref older than the oldest load over-reports, and confirming a name costs one read of the body, so the generous end is safe and an exact guess is not worth making.

An empty result means no commit predates the window. Take the oldest commit the history holds, and say which of the two the ref came from.

### Filling from what the session holds

A session with no cross-feature picture that fills `## State` from git has written a summary of the tree. The reader produces that faster than they can read it.

A writer that opens the prior map edits it rather than rewriting it, and every entry it carries survives one more compaction whether or not it is still true. The board and the roster show what is live now, so a line the prior map held returns only when this session still holds its reason.

## Reading one back

- Read the newest map in the folder, by modification time, and treat it as the previous session's scratch rather than as a source
- Say nothing when no map exists. Absence is the common case, and a line reporting it every run is the noise that makes the present case unnoticeable.
- Re-measure every count, size, and cost the map states, since each was true when written

## Extending it

- Carry every core section whatever else a role adds, and state in the surface that adds a section why the core cannot carry it
- Let the adding surface fix where its own section sits, so a role can place one between core sections where that reads better. The core order holds among the core sections alone.
- Keep a section out of the core when a session holding no such role would leave it unfilled. An unfilled section teaches a reader to skip the file.
- Cite the route onto `## Writing one` rather than restating the procedure, so the extension is the only thing the adding surface carries and the two cannot fall out of step
- Carry a resume instruction inside the map when a compaction takes the routing to it. The map survives what the instruction was loaded from, so each reaches a reader the other cannot.

## Template

```markdown
---
title: Session map
description: <what the board cannot show, and the date it was written>
---

# Session map

<one line marking the file throwaway and naming the board as the real source>

## State

<what is clean, what is running, what is open, and any untracked file that needs committing>

## Mistakes worth not repeating

<one line per mistake, written as the habit it yields>

## Standing cautions

<commands that lie, tools that measure the wrong tree, and anything unbacked>
```

A role-specific section is placed by the surface that adds it, so the skeleton above shows the core alone.
