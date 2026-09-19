---
title: Session map reference
description: Filename and location, the sections a handoff carries, the write and read procedures, and how a role extends it
---

# Session map reference

Applies to `.canon/tasks/session-<slug>.md`. A session writes one before a compaction, because a compaction keeps conclusions and drops the reasoning that produced them. It is rewritten whenever the session that owns it learns something the next session would otherwise re-derive, and it is optional: a project whose sessions never approach a compaction carries none.

Any session writes one. The role a session holds decides which sections it adds on top of the core, never whether it may write at all.

## Scope

Governs the pre-compaction handoff at `.canon/tasks/session-<slug>.md`: its filename, its sections, what a writer puts in each, and how a reader picks one up.

Does not govern:

- The task board the file sits beside, its filenames, and its archiving: `tasks.md`
- The transform from a branch name to the slug in the filename: `slug.md`
- The role-specific sections a caller adds over the core, which belong to that caller
- The note a plain session writes at `.canon/compact/<slug>.md`, whose shape lives in the `session-compact` skill's own reference
- Which memories a session captures before writing, which is the capture surface's own subject

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
- `## Mistakes worth not repeating`: what went wrong and the rule it yields
- `## Standing cautions`: commands that lie, tools that measure the wrong tree, and anything unbacked

Add a section only for content that fits none of the three and would otherwise be lost.

## Writing one

The `session-map` skill is the invocable route onto this procedure and holds no role, so a session reaching for a handoff without knowing this document exists still lands here. A session that arrives at this document directly follows the steps below unchanged.

1. Capture what the session learned first, so the map cites what was written instead of restating the same lesson in prose.
2. Run `canon claude skills drift <the commit this session started from>` and record what it names under `## Standing cautions`. A skill body enters a session once and re-invoking the skill does not re-read the file, so the drift is worst at exactly this moment and a name here is a body the session has been following out of date. Recording a name is not acting on it, and the verb misses a body this session edited and has not committed. This step belongs to session length rather than to any role, so every writer runs it, and a refusal names the boundary of what the verb can read rather than a fault.
3. Recover that commit from how long the session has been running with `git log -1 --format=%H --before='<duration> ago'`, rounding the duration up rather than down. Nothing on the machine records it. A ref older than the oldest load over-reports, and confirming a name costs one read of the body, so the generous end is the safe one and a guess at the exact commit is not worth making. An empty result means no commit predates the window, so take the oldest commit the history holds and say which of the two the ref came from.
4. Write only what a compaction destroys and no other artifact already carries. The board holds the ordering and what each task waits on, a task file holds its own findings, and a measurement folder holds its track.
5. Cite a commit, a task, or a file and line for every claim, so the next session can tell a read from a recall.
6. Fill a section from reasoning the session actually holds. A session with no cross-feature picture that fills `## State` from what is already in git has written a summary of the tree, which the reader can produce faster than they can read it.

Do not restate the board, and do not summarize the work that shipped, since version control already carries it.

## Reading one back

- Read the newest map in the folder, by modification time, and treat it as the previous session's scratch rather than as a source
- Say nothing when no map exists. Absence is the common case, and a line reporting it every run is the noise that makes the present case unnoticeable.
- Re-measure every count, size, and cost the map states, since each was true when written

## Extending it

- Carry every core section whatever else a role adds, and state in the surface that adds a section why the core cannot carry it
- Let the adding surface fix where its own section sits, so a role can place one between core sections where that reads better. The core order holds among the core sections alone.
- Keep a section out of the core when a session holding no such role would leave it unfilled. An unfilled section teaches a reader to skip the file.
- Cite the route onto `## Writing one` rather than restating the procedure, so the extension is the only thing the adding surface carries and the two cannot fall out of step
- Carry a resume instruction inside the map itself when the routing to that instruction is what a compaction takes. The map survives what the instruction was loaded from, so each reaches a reader the other cannot.

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

<what went wrong and the rule it yields>

## Standing cautions

<commands that lie, tools that measure the wrong tree, and anything unbacked>
```

A role-specific section is placed by the surface that adds it, so the skeleton above shows the core alone.
