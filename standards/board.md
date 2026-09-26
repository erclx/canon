---
title: Board reference
description: Readiness groups, row cells, and ordering for priority.md, the unordered backlog.md beside it, and the generated index under .canon/tasks/
---

# Board reference

Applies to `.canon/tasks/priority.md`, `.canon/tasks/backlog.md`, and `.canon/tasks/index.md`, the three files beside the tasks that say which one runs next. Update `priority.md` when a task is filed, planned, dispatched, or blocked, and `backlog.md` whenever the board is swept.

## Scope

Governs the board files under `.canon/tasks/`: the readiness groups and their columns in `priority.md`, row order and the reason each row states, the backlog beside it, and the generated index.

Does not govern:

- The task files the rows link to, their filenames, format, origin lines, and archiving: `tasks.md`
- The plan a `## Run now` row cites and the file set it declares: `plan.md`
- The pre-compaction handoff sitting in the same folder: `session.md`

## What a working board looks like

A board works when a session reading it alone can answer:

- Which task can a worker be handed now, and which files would it collide on?
- What is each blocked task waiting on, and what would clear it?
- Which task gets planned next, and what is it ranked against?

A board failing these is non-conforming even when it satisfies every shape rule below.

## The files

`canon tasks list` reports each task's readiness from `priority.md` and `backlog.md`, so a reader never infers it from the folder.

`backlog.md` is optional. A project small enough that every task it holds would be planned soon carries none, and the ordering rules below then describe the whole board.

`index.md` is generated from sibling frontmatter. The folder is gitignored, so the whole-repo index walk skips it and a hook passing the changed path regenerates it instead. Never hand-edit it.

The catalog is the one reader that filters nothing, so it carries a row per sibling alongside the tasks, handoffs included. Anything reading the catalog as the backlog therefore does its own filtering, and a reader that takes every row as a task reports the handoffs as queued work.

## Ordering

`priority.md` carries execution order and what each task is waiting on. The generated index sorts by filename and says nothing about order, so without this file board state gets reconstructed by hand every session. Why a row sits where it does inside its group is stated on the row itself, in the column that already carries what the task is waiting on, one line per row.

That cell is the only home sequencing rationale has. Rationale spanning several rows, why one group of work runs before another, is carried by nothing and reaches a later session only through whoever remembers it. Naming the gap is deliberate: a second document holding it would be the version-sequencing surface this board replaced, and a row already states what it waits on, which is the part of the reasoning a reader acts on.

Group tasks by readiness rather than by status, one row per task, under the columns each group fixes below. Keep it to links and blockers: tables, plus at most one sentence per section. A paragraph in `priority.md` is a defect whatever it says. Stating the shape this way is what lets a single diff fail, since a size cap only trips after the fact and every addition looks defensible on its own.

### Readiness groups

Readiness is three groups under fixed headings, `## Run now`, `## Up next`, and `## Needs a plan`, in that order. The names are the contract rather than a suggestion, because a board grouped by readiness under names of its own satisfies every other rule here and still reads as empty to anything counting rows under a heading. Add no fourth group. A task belongs to exactly one, and the tests are read in order.

- `## Run now`: a written plan covers every open outcome, and the task carries no reason it cannot start. A collision against the files something already running touches is one such reason, and the `Touches` column is what states it. A worker is handed a task from this group alone.
- `## Up next`: a written plan exists, and the task carries a stated reason it cannot start. The `Waiting on` column names that reason.
- `## Needs a plan`: everything else. The task has no plan, or the plan it carries no longer describes the work.

Each group fixes its own columns, which follow from the test above it rather than from preference. Neither half of the `## Run now` test is checkable without the file set and the plan sitting beside the task.

A `Touches` cell is copied from its plan's own list, so it states what the branch sets out to write rather than a bound on it, and a branch outgrows it while the row still reads as it did at dispatch. Correct the cell from the branch rather than from the plan once one is running, since the plan is the prediction that already went stale and only the diff says what was written. `canon tasks plan-reach <plan>` reads that diff against every live plan and every cell in this group, and the row's owner is the one who writes the correction: a worker never edits this board.

### Row order

Row position inside `## Needs a plan` is the order those tasks get planned in, top first. The three tests answer whether a task can start, which is mechanical, and none of them answers which task is worth starting, which is a judgment no column holds. Position is where that judgment is recorded, so the top row is the answer to what to plan next and a reader needs no other surface to get it. The other two groups take the same reading, and it costs them little, since a group holding what is already planned is short by construction.

Position alone carries it, and no rank column exists. A number beside each row is a second thing to keep in step with the order it duplicates, and the file is edited by one session at a time, so the order the rows are written in is already unambiguous. State on each row why it sits where it does, in the same cell that carries what it is waiting on. A position with no stated reason is re-derived from memory by the next session, which is the failure the ordering replaces rather than moves.

### The waiting-on cell

The `Waiting on` column under `## Up next` carries that reason in one of three forms. `## Needs a plan` states no file set at all, because a task with no plan has no bounded one to state. A group with no rows keeps its heading and its header row.

Under `## Up next` a collision names the file held by the task already running, a sibling task names that task, and an external condition names both the condition and what would satisfy it. Naming what would satisfy it is what separates a blocked row from one nobody has examined, so a cell stating a condition with no way out of it fails the test. The header text is the contract the way the group names are, because anything reading the cell resolves the column by header rather than by position.

Under `## Needs a plan` the cell carries two halves and each takes one clause: what the task needs before it can be planned, then why it sits at this position. The second clause is comparative, and it names what the row is ranked against in one of two forms: a sibling row, or the class of rows it sits in. The row `leads`, `heads`, `opens`, `closes`, `trails`, `precedes`, `follows`, or `outranks` whichever it names, or `sits under`, `above`, or `below` it. Either form puts something other than this row in the clause, which is what makes the position readable by anyone but its author.

Why the task matters is not that claim, and it is what the cell drifts into. A reason naming no other row ranks against nothing, so every row reads defensible on its own and the order records when each was filed. The comparison replaces that reason rather than joining it, since the cell still takes two clauses and no third one is licensed by naming a rival in the second. A cell running past that is the paragraph this file already deletes, arriving one row at a time rather than all at once, and the group is where it costs the most, since it holds the rows nobody has read recently and is the longest group on any board that needs a backlog at all.

`canon tasks validate` reads that clause back, so a cell phrased comparatively and unusually reports as unranked. The vocabulary above is the whole of what it recognizes, and widening it is a change to the check rather than something the cell may decide for itself.

```markdown
---
title: Priority
description: One line on what the board covers
---

# Priority

## Run now

| Task                            | Touches                 | Plan                                 |
| ------------------------------- | ----------------------- | ------------------------------------ |
| [vXX.Y <slug>](vXX.Y-<slug>.md) | <what the task touches> | [<slug>](../plans/feature-<slug>.md) |

## Up next

| Task | Touches | Waiting on |
| ---- | ------- | ---------- |

## Needs a plan

| Task                            | Waiting on                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------- |
| [vXX.Y <slug>](vXX.Y-<slug>.md) | <what it needs before it can be planned, and which row or class it ranks against> |
```

The tests live here so the board does not carry them. Writing them as a sentence under each heading produces the paragraph the rule above deletes, and a criterion with no home gets restated from memory every time the board is touched.

## The backlog

A task sits on the board when it would plausibly be planned within the next few waves, and on `backlog.md` otherwise. The call is a judgment, so restate it whenever the board is swept rather than making it once: a backlogged task rises when the work in front of it lands or the world changes under it, and a board row falls to the backlog when it stops being near-term.

A mechanical test over age or origin was the alternative and neither predicts what gets picked next, which is the judgment the ordering exists to carry. Leaving everything on the board is the other alternative, and it is what produces a group too long to rank, where the ordering means nothing because nobody can hold the whole list in one reading.

What the split buys is that the board is short enough for its order to be read, and what it costs is a second surface to keep. That trade only pays while the backlog stays honest about what it is, which is why it carries no order, no groups, and no readiness claim.

Nothing is deleted. A backlogged task keeps its file, its findings, and its frontmatter, and the backlog row is a pointer at that file. The folder is gitignored and has no history behind it, so a row dropped without landing somewhere readable is gone with nothing to recover it from.

The backlog is a flat list of links under one heading, sorted by filename. Sorting mechanically is what keeps it from reading as a queue: the order is the same order the index already sorts in, so no position on it means anything.

```markdown
---
title: Backlog
description: One line on what the backlog holds
---

# Backlog

Unordered. Nothing here is scheduled, and a task rises to `priority.md` when it becomes near-term.

- [vXX.Y <slug>](vXX.Y-<slug>.md)
- [vXX.Y <slug>](vXX.Y-<slug>.md)
```

Add no fourth readiness group in place of this file. The three group names are the contract, and a backlog is a separate surface rather than a group because it makes no readiness claim at all: it says nobody has scheduled the task, which is a fact about attention rather than about whether the work can start.

## Validation

`canon tasks validate` reads the board against the tree, and what it checks, what it refuses on, and what it reports are at `canon docs tasks-validate`. Run it when the readiness claim is made rather than on a schedule, since the board is gitignored per-machine scratch and no shared moment exists to hang it on.
