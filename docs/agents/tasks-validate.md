---
title: Tasks validate
description: Validating the board against the tree, the seven checks, the untested, claims, and unplaced arrays, the exit codes, and the refusal reasons
---

# Tasks validate

`canon tasks validate` reports what each row of `priority.md` claims against what the tree holds. It reads and never writes, because a row is a session's claim about readiness and a validator that repaired one would be asserting the claim it exists to test.

```bash
canon tasks validate
canon tasks validate --json
```

Seven checks run. Collisions reaches one half of the `## Run now` test the board standard states, and Plan reaches every group, reading the Plan column under `## Run now` and the task file's own line under the other two. Mapping and Grouping test the folder contract and hold for every group, and Shape holds for every group too, ahead of the four. Ordering reaches only the `## Needs a plan` rows, and Blockers reaches every row outside `## Run now`:

| Check      | What it reports                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Shape      | A row whose cell count disagrees with its table's header, or one stranded behind a table a blank line already closed    |
| Plan       | A row whose plan citation disagrees with its group or its task file, or a task whose `Plan:` line links several plans   |
| Mapping    | A row or backlog line naming no task file                                                                               |
| Grouping   | A task carrying a row in more than one readiness group, or on both surfaces                                             |
| Ordering   | A `## Needs a plan` row whose stated position disagrees with where it actually sits, or which states no position at all |
| Collisions | Two `## Run now` rows whose Touches columns name a path in common                                                       |
| Blockers   | A parked row whose blocker has stopped holding, whose cited task resolves nowhere, or whose cited task was declined     |

Shape runs before any other check reads a row, since a row failing it carries no dependable fields for the rest to check. A blank or prose line closes the table above it, so the walk treats the next pipe line as a fresh header candidate rather than as a continuation. That candidate counts as a header only when the line behind it is a separator carrying the same cell count, and one that fails is `row-untabled`, stranded behind a table that already closed. Cell count still has to match the header on every row that clears that test, and a row whose count disagrees is `row-misshapen`, the shape a dropped pipe or a merged column produces.

The Plan check reads the row and the task file both, because the two are written by different hands and only the task's own `Plan:` line reaches the archive. A row carrying a plan whose task states none is `plan-uncited`, and a pair naming two different plans is `plan-mismatched`. Both sides resolve against the board and against the project root before they compare, so a row writing `../plans/x.md` and a task writing `.canon/plans/x.md` name one file rather than two.

The other two groups have no Plan column, so the same check reads the task file's own `Plan:` line against what the group name claims. A `## Needs a plan` row whose task cites a plan that sits live on disk is `plan-parked`, since the group says no such plan exists and the row is either misplaced or its plan is stale and belongs in the archive. An `## Up next` row whose task cites no live plan is `plan-absent`, since that group says one is written. A plan already archived, or a cited path with no file behind it, reads as not live on both sides. A row whose task file is gone is left to `task-unresolved`. An `## Up next` row with nothing left to build, waiting on an act only a person can take, reports `plan-absent` once its plan archives while the task stays live. That report is expected, since the check reads the task file and not the `Waiting on` prose, so a row in that state moves to `## Needs a plan` or closes.

A task whose `Plan:` line links more than one plan is `plan-several` in every group, and it replaces the `plan-uncited` or `plan-absent` report the line would otherwise draw. The line is there, so saying it is missing would send the reader looking for the wrong fault. The line breaks the one-plan-per-task rule the tasks standard states instead, and `plan-mismatched` does not fit either, since that kind means the row and the task disagree while here the task alone is at fault. The message lists every plan the line links, and the fix is to split the task or drop the extra links.

Mapping spans two surfaces, because a task sits on `priority.md` when it would plausibly be planned soon and on `backlog.md` otherwise. A row or a backlog line naming no task file is `task-unresolved`, and a file both surfaces name is `row-duplicated` for the reason a task in two groups is: it claims two things about itself and only one can hold. A task file neither surface names is `unplaced` rather than a finding, since that is the normal state between a session filing it and a live orchestrator placing it on the board. One check across both is what lets a task move between them without the move reading as a dropped file.

A backlog line is a bullet carrying a link to a sibling task, since the backlog is a flat unordered list rather than a table. A bullet holding prose is skipped rather than reported, which keeps the file's own intro out of the findings, and the task that bullet meant to name still lands in the `unplaced` array below rather than the findings. A project carrying no `backlog.md` reads as an empty backlog rather than a refusal.

Ordering reads a `## Needs a plan` row's `Waiting on` cell for the position it claims, and reports two failures off one walk. A row stating an ordinal is checked against where it actually sits, which is `row-misordered`. A row claiming no position in either form it may take is `row-unranked`, since its cell argues the task matters and ranks it against nothing, which leaves the order recording when each row was filed.

The ordinal phrase is prose rather than data, searched for anywhere in the cell rather than at its start, since every live row states its position at the end of a sentence rather than at the front. The vocabulary stops at `first` through `twentieth` plus `last`, since a parser strict enough to catch a gap would otherwise flag a row phrased correctly and differently, and bounding it to those words is what keeps a cell reading `Untestable from here` from matching on `from`. One comparison against the real position catches a gap, a duplicate, and a sequence starting somewhere other than first alike.

The comparative phrase is bounded the same way and for the same reason. A closed verb list of `leads`, `heads`, `opens`, `closes`, `trails`, `precedes`, `follows`, `outranks`, and `sits under`, `above`, or `below` has to sit in one clause with a positional object, which is a `vNN.N` phase label, the word `group`, or `row` or `rows`. Both halves are needed, since a cell reading `it closes a gap the reference gate leaves open` carries the verb and claims no position, and the clause bound is what stops a verb in one half of the cell pairing with an object in the other. An ordinal exempts the row, being a comparative claim already. An unusual comparative phrasing reports as unranked, the safe direction for a check over prose, and a vocabulary verb reaching a positional object non-positionally reports as ranked, which only grading prose could separate.

The collision check is the one a person cannot run by eye. Paths come from the backticked spans in the Touches column, a span naming no file is dropped, and a directory collides with any file beneath it. A `## Run now` row whose column parses to nothing is reported rather than skipped, since a row stating no file set makes a claim nothing can check.

Where a directory holds the other row's file, the finding names the row that claimed it, reading `both touch src/tasks, which v2.0-second claims as a folder.` The shared strings alone leave an over-broad cell and a genuine overlap identical. <!-- canon-allow-reference: illustrates the finding's own sentence shape, not a citation of a real task -->

The blocker check re-takes a measurement the board records once and never repeats. Two of the five blocker kinds put a fact on disk: a dependency is settled by the cited task being archived or by its work reaching the trunk, and a collision is settled by nothing under `## Run now` still holding the file the cell cites. A cited task resolving under `.canon/tasks/declined/` instead reports separately as `blocker-declined`, since a decided-against task is neither the shipped work `blocker-settled` reports nor the dangling pointer `blocker-unresolved` reports.

```json
{
  "findings": [
    {
      "kind": "blocker-declined",
      "group": "Up next",
      "subject": "v50.6-a-standard-no-skill-reads", // canon-allow-reference: shows the subject field's real vXX.Y-slug shape, not a citation of a real task
      "message": "waits on v9.0-superseded, which was declined." // canon-allow-reference: illustrates the finding's own sentence shape, not a citation of a real task
    }
  ]
}
```

A closed outcome is not the fact the dependency half needs. The ship chain marks outcomes as its first step and opens the pull request several steps later, so a check reading the checkbox reports the row settled while the branch is still in review. A live task therefore settles the row only once it closed every outcome and carries a `Pull request:` line the trunk holds. One that names no pull request, and one whose number no trunk ref could answer for, land in the untested array below rather than being settled or left silent.

The trunk is read as the clone already holds it, `origin/main` first and local `main` behind it, and no run fetches. A validate runs several times a sweep and a fetch per run is a cost this command does not carry, so a clone behind its remote under-reports rather than claiming work landed.

Both halves gate on a citation inside the `Waiting on` cell, never on the columns beside it. The board format gives a collision cell the file held by the running task, so a row whose cell names no file was parked by something else, and testing its Touches column instead reports a cleared collision on a row no collision ever parked while counting that row as re-tested. A cited task is a bare sibling link, the way the Task column spells one, so a pointer into another folder names a plan rather than a task and settles nothing. A cited task carrying no outcome box settles nothing either, since a file the check could not parse is not evidence of a finished one.

A citation resolving in none of the board, the archive, or the declined folder is `blocker-unresolved` rather than a settled row. Reading an absent file as archived or declined states a specific fact about a file nobody ever wrote, which is what a renamed task or a typo produces, and only a task that genuinely closed or was genuinely declined releases the row waiting on it.

The other three kinds rest on a person's judgment, so a row neither half reached lands in a second array rather than in the findings:

```json
{
  "untested": [
    {
      "group": "Needs a plan",
      "subject": "v50.6-a-standard-no-skill-reads", // canon-allow-reference: shows the subject field's real vXX.Y-slug shape, not a citation of a real task
      "message": "..."
    }
  ]
}
```

An untested row is not a finding and moves no exit code. Reading a clean findings list as a clean board is the failure the array exists to prevent, and `orchestrator-parked.md` is the pass that takes those rows by hand.

A `## Run now` row whose Touches column names a bare folder lands in a third array on the same reasoning:

```json
{
  "claims": [
    {
      "group": "Run now",
      "subject": "v1.0-first", // canon-allow-reference: shows the subject field's real vXX.Y-slug shape, not a citation of a real task
      "message": "claims the whole src/tasks folder, so it collides with every row written under it."
    }
  ]
}
```

That claim collides with every row a later session writes under the folder, and it is legitimate whenever the row does rewrite the directory, so the array states the reach and moves no exit code. A measure failing on a cell that is right teaches a reader to skip it. Folder against file is decided by asking the tree for a path that resolves, and by the extension only for a path the row has yet to create, since the name alone reads a file carrying no extension as a folder.

The scan reaches `## Run now` and stops, where the collision check stops. A cell in another group describes work nobody has planned, written as a sentence and rewritten once a plan exists, so a claim read off one reports on prose rather than on a file set. A parked folder claim surfaces when its row is promoted, which is when the cell becomes something a dispatcher can act on.

A task file neither surface names lands in a fourth array, on the same reasoning:

```json
{
  "unplaced": [
    {
      "subject": "v50.6-a-standard-no-skill-reads", // canon-allow-reference: shows the subject field's real vXX.Y-slug shape, not a citation of a real task
      "message": "is a task file with no row on the board and no line on the backlog."
    }
  ]
}
```

Under the roster-checked hand-off `task-board` and `plan-groundwork` state, filing a task and placing its row are two acts a different session each may take, so a task caught between the two is ordinary rather than a finding and this array moves no exit code. It still reports, since it is the only local detector for a row a hand-edit dropped, a handoff message that never arrived, or an orchestrator that ended before placing it.

Exit codes: `0` every check passed, `1` refused, `2` at least one finding. The `reason` field carries which gate refused: `no-board`, `no-ordering`, or `no-groups`. A board grouping under headings of its own trips `no-groups` rather than being read against columns it never declared.

Columns are read from each table's own header rather than by position, so a project whose board differs from this one is reported for what it lacks. The `index`, `priority`, and `backlog` siblings are skipped, along with every pre-compaction handoff, which takes one file per session under a `session-` prefix. None of them is a task, and a handoff counted as one would be reported as a task carrying no row on every session that wrote one.

Skills branch on the findings rather than on the exit code:

```bash
canon tasks validate --json | jq -r '.findings[] | "\(.kind): \(.subject)"'
```

For the board format, see `standards/board.md`. For the `Pull request:` line and the archive rules, see `standards/tasks.md`.
