---
title: Board reference
description: Readiness groups, row cells, and ordering for priority.md, the unordered backlog.md beside it, and the generated index under .canon/tasks/
---

# Board reference

Applies to `.canon/tasks/priority.md`, `.canon/tasks/backlog.md`, and `.canon/tasks/index.md`, the three files beside the tasks that say which one runs next. Update `priority.md` when a task is filed, planned, dispatched, or blocked, and `backlog.md` whenever the board is swept.

## Contents

- [Scope](#scope)
- [What a working board looks like](#what-a-working-board-looks-like)
- [The files](#the-files)
- [Ordering](#ordering)
- [The backlog](#the-backlog)
- [Validation](#validation)

## Scope

Governs the board files under `.canon/tasks/`: the readiness groups and their columns in `priority.md`, row order and the reason each row states, the backlog beside it, and the generated index.

Does not govern:

- The task files the rows link to, their filenames, format, origin lines, and archiving: `tasks.md`
- The plan a `## Run now` row cites and the file set it declares: `plan.md`
- The pre-compaction handoff sitting in the same folder: `session.md`

## What a working board looks like

A board works when a session reading it alone can answer:

- Which task can a worker be handed now, and which files does it share with work already running?
- What is each blocked task waiting on, and what would clear it?
- Which task gets planned next, and what is it ranked against?

A board failing these is non-conforming even when it satisfies every shape rule below.

## The files

`canon tasks list` reports each task's readiness from `priority.md` and `backlog.md`, so a reader never infers it from the folder.

| File          | Rule                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| `priority.md` | Required. Carries execution order and what each task waits on                             |
| `backlog.md`  | Optional. A project whose every task would be planned soon carries none                   |
| `index.md`    | Generated from sibling frontmatter by a hook passing the changed path. Never hand-edit it |

The folder is gitignored, so the whole-repo index walk skips it. The catalog filters nothing and carries a row per sibling, handoffs included, so a reader taking every row as a task reports the handoffs as queued work.

## Ordering

`priority.md` carries execution order and what each task waits on. The generated index sorts by filename and says nothing about order, so without this file board state gets rebuilt by hand every session.

### Where the rationale lives

Why a row sits where it does is stated on the row, in the cell that already says what the task waits on, one line per row.

- Rationale spanning several rows has no home, and the gap is deliberate. A second document holding it would be the version-sequencing surface this board replaced.
- The row already states what it waits on, which is the part of the reasoning a reader acts on.

### The shape

Group tasks by readiness rather than by status, one row per task, under the columns each group fixes. Keep it to links and blockers, being tables plus at most one sentence per section.

- A paragraph in `priority.md` is a defect whatever it says
- Stating the shape lets a single diff fail. A size cap trips only after the fact, and every addition looks defensible on its own.

### Readiness groups

Readiness is three groups under fixed headings, `## Run now`, `## Up next`, and `## Needs a plan`, in that order. A task belongs to exactly one, and the tests are read in order.

| Group             | Test                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| `## Run now`      | A worker was dispatched on it, under a written plan covering every open outcome      |
| `## Up next`      | A written plan exists and no worker holds it yet, and `Waiting on` names what is due |
| `## Needs a plan` | Everything else. No plan, or a plan that no longer describes the work                |

The names are the contract. A board grouped by readiness under names of its own reads as empty to anything counting rows under a heading, so add no fourth group.

### Writing the board

Every write goes through `canon tasks place`, `promote`, `move`, or `block`, each reading the file once, rendering the columns the template fixes, and writing it once. `plan-link` promotes a parked row the same way. Only `Waiting on` is typed, since every other cell derives from the task and its live plans.

### What blocks a run

A collision with running work blocks a task only where no merge settles it, being a contract, a relocation, or a sweep. A shared file alone is none, since the branch merging second rebases.

- A dispatcher picks from `## Up next` and runs `canon tasks promote` once the launch succeeds
- Each group's columns follow from its test. Neither half of the `## Up next` test is checkable without the file set and the plan beside the task.

### The `Touches` cell

A `Touches` cell counts its plans' declared files and names the two fullest folders, as in ``12 files under `src/tasks/`, `claude/skills/` ``. The linked plan holds the file list, which the overlap checks read.

- `canon tasks plan-reach <plan>` reads the reach a running branch grew to
- Change the plan's list to change the cell. A worker never edits this board.

### Cell width

A cell holds no code span whose longest unbroken run passes 60 characters. A span has no break point, and a wider one makes its table scroll sideways in the preview.

- Write a brace-glob out as separate paths for the same reason
- `canon tasks validate` reports both in its `wide` array and moves no exit code

### Row order

Row position inside `## Needs a plan` is the order those tasks get planned in, top first. The three tests answer whether a task can start, and none answers which task is worth starting, a judgment no column holds.

- Position records that judgment, so the top row answers what to plan next. The other two groups read position the same way, and they are short by construction.
- No rank column exists. A number beside each row duplicates the order, and one session edits the file at a time, so the written order is unambiguous.
- A position with no stated reason gets re-derived from memory by the next session, the failure the ordering replaces

### The waiting-on cell

The `Waiting on` column under `## Up next` carries the reason in one of three forms. `## Needs a plan` states no file set, because a task with no plan has no bounded one. A group with no rows keeps its heading and header row.

| Form               | The cell names                                                                |
| ------------------ | ----------------------------------------------------------------------------- |
| Collision          | The file the running task holds, and whether a contract, relocation, or sweep |
| Sibling task       | That task                                                                     |
| External condition | The condition and what would satisfy it                                       |

Naming what would satisfy a condition separates a blocked row from one nobody examined, so a condition with no way out fails the test. The header text is the contract, since a reader resolves the column by header rather than position. A cell renders at most 120 characters, a link counting as its label alone, and the verbs refuse a longer one.

### The needs-a-plan cell

Under `## Needs a plan` the cell takes two clauses, being what the task needs before it can be planned and then why it sits at this position. The second clause names what the row ranks against, a sibling row or the class of rows it sits in.

- The row `leads`, `heads`, `opens`, `closes`, `trails`, `precedes`, `follows`, or `outranks` what it names, or `sits under`, `above`, or `below` it
- Either form puts something other than this row in the clause, which makes the position readable by anyone but its author
- `canon tasks validate` reads that clause back and recognizes this vocabulary alone. A phrasing outside it reports as unranked, and widening it is a change to the check.

### What the cell drifts into

Why the task matters is not the comparative claim, and it is what the cell drifts into. A reason naming no other row ranks against nothing, so every row reads defensible and the order records only when each was filed.

- The comparison replaces that reason rather than joining it, and no third clause is licensed by naming a rival in the second
- A longer cell is the deleted paragraph arriving one row at a time. It costs most in this group, which holds the rows nobody read recently.

### Template

The tests live here so the board does not carry them. A sentence under each heading produces the deleted paragraph, and a criterion with no home gets restated from memory each time.

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

## The backlog

A task sits on the board when it would plausibly be planned within the next few waves, and on `backlog.md` otherwise. Restate that judgment whenever the board is swept, since a backlogged task rises when the work in front of it lands and a board row falls when it stops being near-term.

### Why a split

A test over age or origin was the alternative, and neither predicts what gets picked next. Leaving everything on the board produces a group too long to rank.

- The split keeps the board short enough for its order to be read, at the cost of a second surface
- The trade pays only while the backlog carries no order, no groups, and no readiness claim

### Shape

Nothing is deleted. A backlogged task keeps its file, findings, and frontmatter, and the row points at that file. The folder has no history, so a row dropped without landing somewhere readable is gone.

The backlog is a flat list of links under one heading, sorted by filename. The order matches the index, so no position on it reads as a queue.

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

Add no fourth readiness group in place of this file. A backlog makes no readiness claim, only that nobody has scheduled the task, a fact about attention rather than whether the work can start.

## Validation

`canon tasks validate` reads the board against the tree, and `canon tasks validate --help` states what it checks, refuses on, and reports. Run it when the readiness claim is made rather than on a schedule, since the board is per-machine scratch and no shared moment exists to hang it on.
