---
title: Tasks reference
description: Folder layout, filename convention, readiness groups, and content rules for .canon/tasks/
---

# Tasks reference

Applies to `.canon/tasks/`. Tracks what is being built and why, at the level of features and outcomes. One file per task.

Update when a task starts, completes, or changes scope. When to open a task at all is project policy, not a shape rule, and lives in `CLAUDE.md`.

The folder is gitignored. Board state changes when work ships rather than when a branch is written, so committing it would put a claim about the future into the diff of an unrelated pull request. The git log records what shipped.

## Scope

Governs the task board under `.canon/tasks/`: folder layout, filenames, frontmatter, file format, origin lines, execution ordering, the backlog beside it, and archiving.

Does not govern:

- The plan file a task cites, its sections, and its answer contract: `plan.md`
- Phase-label format and which surfaces a label may appear on: `versioning.md`
- Architectural reasoning that outlives a task: `architecture.md`
- The pre-compaction handoff sitting in the folder, its filename and its sections: `session.md`
- When a project opens a task at all, which is project policy rather than a shape rule

## Layout

```plaintext
.canon/tasks/
├── index.md              ← generated, never hand-edited
├── priority.md           ← hand-maintained execution order
├── backlog.md            ← unordered, what is not being scheduled
├── session-<slug>.md     ← optional, what a compaction is about to destroy
├── archive/              ← shipped tasks, moved by canon tasks archive
├── declined/             ← decided-against tasks, moved by canon tasks decline
├── v09.0-sync-paths.md      # canon-allow-reference: illustrates the vXX.Y-slug filename this section defines
└── v13.0-toolkit-drift.md   # canon-allow-reference: illustrates the vXX.Y-slug filename this section defines
```

One file per task is what keeps the board safe under parallel sessions. Two sessions working different tasks never write the same file, which matters because a gitignored board has no history to recover a clobbered write from.

Siblings sit in the folder without being tasks, and each earns its place by being governed somewhere. `index.md`, `priority.md`, and `backlog.md` are governed here. Every `session-` file is a pre-compaction handoff governed by `session.md`, and each is optional: a project whose sessions never approach a compaction carries none. Anything filtering the folder to tasks skips all of them, so a name outside the set is a task whatever it holds.

`backlog.md` is optional too. A project small enough that every task it holds would be planned soon carries none, and the ordering rules below then describe the whole board.

The handoff takes one file per session for the reason a task does. A single shared path puts two sessions closing near each other on one file that neither can watch the other write, and the loser leaves no trace on a board with no history behind it.

`index.md` is generated from sibling frontmatter. The folder is gitignored, so the whole-repo index walk skips it and a hook passing the changed path regenerates it instead. Never hand-edit it.

The catalog is the one reader that filters nothing, so it carries a row per sibling alongside the tasks. That is what a folder catalog is for, and the handoffs are what make it worth stating: a board accumulates one row per session that ever wrote one, with nothing pruning them. Anything reading the catalog as the backlog therefore does its own filtering, and a reader that takes every row as a task reports the handoffs as queued work.

The `task-board` skill creates and archives task files, and the archive carries the task's plan with it. `docs-fold` marks outcomes `[x]` in an existing file. Neither does the other's job.

## Ordering

`priority.md` carries execution order and what each task is waiting on. The generated index sorts by filename and says nothing about order, so without this file board state gets reconstructed by hand every session. Why a row sits where it does inside its group is stated on the row itself, in the column that already carries what the task is waiting on, one line per row.

That cell is the only home sequencing rationale has. Rationale spanning several rows, why one group of work runs before another, is carried by nothing and reaches a later session only through whoever remembers it. Naming the gap is deliberate: a second document holding it would be the version-sequencing surface this board replaced, and a row already states what it waits on, which is the part of the reasoning a reader acts on.

Group tasks by readiness rather than by status, one row per task, under the columns each group fixes below. Keep it to links and blockers: tables, plus at most one sentence per section. A paragraph in `priority.md` is a defect whatever it says. Stating the shape this way is what lets a single diff fail, since a size cap only trips after the fact and every addition looks defensible on its own.

Readiness is three groups under fixed headings, `## Run now`, `## Up next`, and `## Needs a plan`, in that order. The names are the contract rather than a suggestion, because a board grouped by readiness under names of its own satisfies every other rule here and still reads as empty to anything counting rows under a heading. Add no fourth group. A task belongs to exactly one, and the tests are read in order.

- `## Run now`: a written plan covers every open outcome, and the task carries no reason it cannot start. A collision against the files something already running touches is one such reason, and the `Touches` column is what states it. A worker is handed a task from this group alone.
- `## Up next`: a written plan exists, and the task carries a stated reason it cannot start. The `Waiting on` column names that reason.
- `## Needs a plan`: everything else. The task has no plan, or the plan it carries no longer describes the work.

Each group fixes its own columns, which follow from the test above it rather than from preference. Neither half of the `## Run now` test is checkable without the file set and the plan sitting beside the task.

A `Touches` cell is copied from its plan's own list, so it states what the branch sets out to write rather than a bound on it, and a branch outgrows it while the row still reads as it did at dispatch. Correct the cell from the branch rather than from the plan once one is running, since the plan is the prediction that already went stale and only the diff says what was written. `canon tasks plan-reach <plan>` reads that diff against every live plan and every cell in this group, and the row's owner is the one who writes the correction: a worker never edits this board.

Row position inside `## Needs a plan` is the order those tasks get planned in, top first. The three tests answer whether a task can start, which is mechanical, and none of them answers which task is worth starting, which is a judgment no column holds. Position is where that judgment is recorded, so the top row is the answer to what to plan next and a reader needs no other surface to get it. The other two groups take the same reading, and it costs them little, since a group holding what is already planned is short by construction.

Position alone carries it, and no rank column exists. A number beside each row is a second thing to keep in step with the order it duplicates, and the file is edited by one session at a time, so the order the rows are written in is already unambiguous. State on each row why it sits where it does, in the same cell that carries what it is waiting on. A position with no stated reason is re-derived from memory by the next session, which is the failure the ordering replaces rather than moves.

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

`canon tasks validate` reads the board against the tree, and what it checks, what it refuses on, and what it reports are at `canon docs tasks`. Run it when the readiness claim is made rather than on a schedule, since the board is gitignored per-machine scratch and no shared moment exists to hang it on.

## Filenames

`vXX.Y-<slug>.md`, where the version is the phase label zero-padded to two digits and the slug is kebab-case.

Padding is load-bearing. Index entries sort by filename and nothing else, so a bare `v9.0` sorts after `v15.0` and the catalog reads out of board order. `standards/versioning.md` governs the label itself and permits free renumbering, so expect the occasional rename. Nothing points at a task filename, since a `Plan:` line runs from task to plan rather than the reverse. <!-- canon-allow-reference: illustrates the padding rule's own sort collision, not a citation of a real task -->

## Frontmatter

Every task file carries both fields. The index walker fails the whole folder when one is missing, which surfaces the gap on the next edit.

```yaml
---
title: 'v13.0: Detect and close toolkit drift in target projects' # canon-allow-reference: illustrates the quoted title shape, not a citation of a real task
description: Record what a target installed and report the delta against the toolkit
---
```

- `title`: the phase label and the task title, matching the H1. Quote it, since a leading `vX.Y:` reads as a key to a YAML parser.
- `description`: what the task achieves, in one line. A session reads this in the index to decide whether to open the file.

## File format

Two headings, `## Outcomes` and `## Findings`. Outcomes are future and checkable, findings are past and factual, and as flat bullets at the same indent they are visually identical. A heading separates them at no cost.

Add no third heading. Status stays inline on an outcome rather than becoming an "In progress" section.

Size the outcomes so one pull request closes all of them. A task whose outcomes span two pull requests ships the first half and leaves the rest open, with nothing recording which outcomes the merged work covered, so the board reads as in-progress work that no branch is carrying. Split the task before handing it off rather than after. This is what `## Archiving` below depends on, since a task closes whole or not at all.

Prefix the H1 with the `vX.Y:` phase label, then a short title whose form depends on the task type:

- Feature: an outcome describing what the user can now do
- Fix: a problem statement describing what is wrong
- Chore: an imperative describing what is being done

```markdown
---
title: 'vX.Y: Title'
description: One line on what this task achieves
---

# vX.Y: Title

Plan: [feature-<slug>](../plans/feature-<slug>.md)
Groundwork: [<slug>](../groundwork/<slug>/)
Intake: [<slug>](../intake/<slug>/)
Issue: #NNN
Pull request: #NNN

Why this task exists and what it depends on.

## Outcomes

- [ ] Outcome: what done looks like
- [ ] Outcome: what done looks like

## Findings

- What constrains the task, dated where it matters.

> Test strategy: <unit | component | e2e | visual | manual>, what is being verified
```

## Origin

Every task names where it came from, through a `Plan:`, `Groundwork:`, `Intake:`, or `Issue:` line under the title. Include each only when the file, folder, or issue it names exists.

A task with no origin is either lost context or work nobody decided to do. The invariant runs both ways, and the second direction is the one that bites: a groundwork track, an intake folder, or an open issue that no task points at is work already decided and on its way to being forgotten.

An intake folder answers that direction at folder scope rather than item scope, since one dump dispositions many items and most close without ever becoming a task. What names a folder is every item answered and no task citing it, on the board or in the archive. That is a dump nobody acted on. Counting the archive and declined folder beside the board is what separates it from one already promoted and settled, and a check reading the board alone calls every finished folder abandoned.

`Plan:`, `Groundwork:`, and `Intake:` name their target as a markdown link whose text is the file or folder stem, so the line resolves on a ctrl-click the way `priority.md` rows already do. Write the path relative to `.canon/tasks/`, which makes it `../plans/`, `../groundwork/`, and `../intake/`. A path written from the project root renders as a link and resolves to nothing in an editor rooted at the project. `Ready:` names the ready folder a task's plan copies from, as a link to `../ready/<nn>-<slug>/` with the trailing slash a folder carries. Include it only when the folder exists. `canon tasks archive` reads it to move the folder, and falls back to a `.canon/ready/<nn>-<slug>/` path in the plan when a task carries no line.

`Issue:` stays a bare `#NNN`, since an issue number is not a path and a full URL would write the remote into a gitignored file.

Phase-label format and where labels may appear are governed by `standards/versioning.md`.

`Plan:` points at `../plans/feature-<slug>.md` while the task is open. Once the task ships and the plan is archived, it points at `../plans/archive/feature-<slug>.md`, and at `../../plans/archive/feature-<slug>.md` once the task itself is archived a folder deeper. Retarget both halves of the link rather than dropping it, so a completed task still leads to the reasoning behind it.

A project that archived plans before the folder nested under `.canon/plans/` holds closed tasks pointing at `../plans-archive/`, or at `../.tmp/plans-archive/` from before the durable records left the scratch tree. Each form resolves against the files it names, so leave those pointers where they are. A named route now moves the folder and retargets its pointers together, but no automation runs it, so an unmigrated project keeps holding the old spelling until someone does, and a task retargeted without its plan moving leads nowhere.

One plan per task. A plan cited by two tasks is a misfile rather than a shape to design for, which is why the sweep counts citations before archiving: the count is a guard against the misfile stranding a pointer, not support for the shape.

`canon tasks plan-link <task> <plan>` writes or corrects the `Plan:` line, mirroring how `canon tasks pull-request` writes its own. `plan-feature` calls it right after the plan file lands, when an existing task names the feature, so the line is a mechanical write rather than hand-edited markdown.

`Groundwork:` points at `../groundwork/<slug>/`, the folder `plan-groundwork` fills. It names the surface it points at the way `Plan:` does. Use this key alone. `Research record` and `Decision record` are earlier spellings of the same thing and both convert to it.

`Intake:` points at `../intake/<slug>/`, the folder an intake pass fills. Use it rather than `Groundwork:`, because a groundwork track measures one question in depth while an intake dispositions many across a tree, and one key covering both loses which kind of pass produced the task. The line names the folder rather than an item inside it. A task routinely promotes several items at once, so an anchored line would name one and drop the rest, and the item numbers belong in that task's `## Findings`.

`Pull request:` records which pull request carries the task's work, as a bare `#NNN` the way `Issue:` does. It is not an origin, so a task without one is well-formed. `git-pr` writes it when a pull request opens, which is the one step that always runs whether the chain drives it or a person does.

The line is what lets a merge close its own task. Every merge on `main` is a squash carrying the number in its subject, so the number survives where a branch name does not, and `canon tasks archive --pull-request <n>` resolves the task from it. Without the line the board can only be swept blind, and a blind sweep cannot tell a shipped task from an abandoned one. One task, one pull request: two tasks naming the same number refuse to archive rather than both moving.

## What goes in

- Task entries describing observable behavior, one outcome per line
- A test strategy line naming the mechanism and what it verifies
- Findings stating what constrains the task, including blockers and dependencies
- A deviation from the plan's suggestion, in one line naming what moved the pick. The plan is archived at ship and holds the reasoning, so this register carries what shipped.

## What does not go in

- Class names, file paths, function names, or prop names in any entry or title
- Code-level steps or implementation detail. Behavioral specifics are fine.
- Architectural reasoning that outlives the task. A finding explains why this task is shaped as it is. A decision the system keeps after the task closes belongs in `canon/ARCHITECTURE.md`.
- Narrative of the session that produced the task. A finding states what constrains the task, so what was probed, what it cost, and who decided belongs in the groundwork folder the `Groundwork:` line names. A task with no groundwork folder cuts the narrative rather than relocating it, since the board is not the fallback destination for it.
- "In progress" or "Blocked" headings. Note status inline on the outcome instead.
- Sequencing rationale or which version is active. Why this task is planned before its neighbors goes on its row in `priority.md`, in the cell that already carries what it is waiting on. Rationale wider than one row has no home at all, so cut it rather than filing it here.

## Archiving

Never delete a task file. A shipped task moves to `.canon/tasks/archive/` under its own name, and the live index regenerates without it. `canon tasks archive` owns that move, and what it does and what it refuses on are at `canon docs tasks`.

The archive nests inside `.canon/tasks/` rather than sitting beside it as a flat `.claude/task-archive/`. Nesting is what lets a reader tell the two shapes apart on sight: the flat sibling is what a binary predating this convention still writes, so meeting one names an older checkout rather than a second archive to reconcile against this one.

One destination rather than a per-project choice is what lets the move happen without asking. It mirrors the plans archive at `.canon/plans/archive/`, sitting inside the folder it archives the same way, and it inherits the board's own ignore entry rather than needing one of its own. The cost is that an archived task does not appear in diffs, which is the cost the live board already carries.

Archiving a task archives its plan alongside it, when the closing task is that plan's last live citation. The archived task's `Plan:` line is retargeted at `../../plans/archive/feature-<slug>.md`, a folder deeper than the live task wrote it, so a completed task still leads to the reasoning behind it. The ready folder the task's `Ready:` line names moves with the plan to `.canon/ready/archive/<nn>-<slug>/`, and the `Ready:` line and the plan's path to the folder are retargeted, since the folder is the plan's verbatim source. A plan several tasks share stays live and the task archives anyway, since moving it on the first task to close strands every sibling's pointer at a path that has gone. Its ready folder stays with it.

One act rather than two is what makes the pair safe. The merge is the event that settles a plan, and a `post-merge` hook reaching the archive with nobody watching cannot act on a warning, so a second call after it would be a second failure point leaving the task archived and the plan live.

A task with an open outcome stays on the board, and so does its plan. Close it, or cut it from the task when the work is being abandoned, so what was dropped is recorded rather than inferred from an archived file. Cutting means striking the outcome's body: `- ~~<outcome>~~ <why>`. `archiveTask` reads a struck body as cut whatever its checkbox holds, so a task carrying only cut outcomes still archives and a mixed task carries both counts on its success record.

## Declining

A task decided against moves to `.canon/tasks/declined/` rather than `.canon/tasks/archive/`. The two folders answer different questions: archive means the work shipped, declined means somebody decided against doing it. Neither reading fits a task that is merely unscheduled, which stays on `backlog.md` rather than moving anywhere, since nobody has decided against it and it may still rise when the board has room.

`canon tasks decline` carries no outcome-state gate. A task can be decided against at any outcome state, open outcomes included, which is what separates its refusal set from archive's: the two never share one, since a shared gate would let one archive a task that cannot yet ship or decline one that already has.

The decision is recorded on the task itself with a `Declined:` line, in the `Plan:`/`Pull request:` family: `Declined: <reason>, <who> on <YYYY-MM-DD>`. It anchors the same way `Pull request:` does, after the last origin line the task carries. The line is free prose after the colon, since it names no file to link.

Declining a task moves its plan alongside it the same way archiving does, when the declining task is that plan's last live citation. A plan several tasks share stays where it is, and a declined task's plan lands in `.canon/plans/archive/` indistinguishable from a shipped one by folder alone. The task file under `.canon/tasks/declined/` is what records which it was.

The move clears whichever of `priority.md` or `backlog.md` holds the task's row, since a decided-against task most often comes off the backlog before anyone plans it, but a row already promoted to the ordering file is cleared the same way archive clears it.
