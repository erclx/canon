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
- The plan an `## In flight` row's task cites and the file set it declares: `plan.md`
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

Readiness is three groups under fixed headings, `## In flight`, `## Up next`, and `## Needs a plan`, in that order. A task belongs to exactly one, and the tests are read in order.

| Group             | Test                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| `## In flight`    | A worker was dispatched on it, under a written plan covering every open outcome      |
| `## Up next`      | A written plan exists and no worker holds it yet, and `Waiting on` names what is due |
| `## Needs a plan` | Everything else, being a task with no plan                                           |

The names are the contract, since a heading count reads a renamed group as empty, so add no fourth. An overturned plan is amended in place, its row held under `## Up next` with `canon tasks block` and the reason a Findings line.

Every verb reads the older heading `Run now` as `In flight` and writes the new one, while `readiness` keeps the value `Run now`.

### Writing the board

Every write goes through `canon tasks place`, `promote`, `move`, `block`, or `launch`, each reading the file once, rendering the template's columns, and writing once. `plan-link` promotes a parked row and warns, with `board.next`, on a task with no row. `Waiting on` and `Launch` are typed, and every other cell derives from the task and its plans.

`canon tasks flight` reads each in-flight row's stage live and stores none.

### What blocks a run

A collision with running work blocks a task only where no merge settles it, being a contract, a relocation, or a sweep. A shared file alone is none, since the branch merging second rebases.

- A dispatcher picks from `## Up next` and runs `canon tasks promote` once the launch succeeds
- Each group's columns follow from its test. Neither half of the `## Up next` test is checkable without the file set and the plan beside the task.

### The `Touches` cell

A `Touches` cell counts its plans' declared files and names the two fullest folders, as in ``12 files under `src/tasks/`, `claude/skills/` ``. The linked plan holds the file list, which the overlap checks read.

- `canon tasks plan-reach <plan>` reads the reach a running branch grew to
- Change the plan's list to change the cell. A worker never edits this board.

### The `Launch` and `Session` cells

`Launch` holds the dispatcher's pick, as in `worker, opus, high, background`, with `(operator)` marking an override. `Session` names the last session the task records, and a promote carries the model and effort into it, as in `worker-a (opus, high)`.

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

`canon tasks waves` reads a cell clause by clause.

- A cell splits at a period, comma, semicolon, or `because`, and a clause's cited tasks block, except after a ranking, sharing, `rebases`, or `with` verb.
- `after`, `behind`, `waits on`, `blocked by`, `needs`, or `once` gates again, and a bare list of tasks after a placing clause stays beside it.
- The plans hold a shared file, not the cell. A cell of two clauses or more prints its reading.

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

## In flight

| Task                            | Touches                 | Session                            |
| ------------------------------- | ----------------------- | ---------------------------------- |
| [vXX.Y <slug>](vXX.Y-<slug>.md) | <what the task touches> | <session name> (<model>, <effort>) |

## Up next

| Task | Touches | Launch | Waiting on |
| ---- | ------- | ------ | ---------- |

## Needs a plan

| Task                            | Waiting on                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------- |
| [vXX.Y <slug>](vXX.Y-<slug>.md) | <what it needs before it can be planned, and which row or class it ranks against> |
```

## The backlog

When a task sits on `backlog.md` rather than the board, and that file's shape, are in `backlog.md` beside this file.

## Validation

`canon tasks validate` reads the board against the tree, and `canon tasks validate --help` states what it checks, refuses on, and reports. Run it when the readiness claim is made rather than on a schedule, since the board is per-machine scratch and no shared moment exists to hang it on.
