---
title: Board
description: Why the board is one orchestrator's gitignored scratch, the board and backlog split, what canon tasks validate checks on a row, and where filing stops
---

# Board

## Decisions

### Board constraints

The board, the task files, and the plans are gitignored, which leaves them undated, limits the board to one orchestrator, and puts their citations outside every check.

- **Undated.** History over `.canon/` folders returns nothing, and mtime reads later than the truth. A recoverable opening date is a frontmatter field, which `plan-groundwork` requires.
- **One orchestrator.** A second session reads neither the other's task files nor its archives, so the two write colliding labels and archive each other's plans.
- **Unchecked citations.** Task, plan, and review links appear in no diff, and `canon context audit` covers `canon/context/` alone. A rename under `.claude/` sweeps them by hand.

`role-orchestrator` holds the queue-refill sweep and the method for writing `priority.md`. `canon tasks archive` removes a row on merge, and `task-board` and `plan-groundwork` each write one directly in the roster-checked fallback, when no live orchestrator can take the row.

### A worker files no task

A worker takes neither path and files no task file. `task-board` Create stops a session holding the worker role before `canon tasks next-label --claim` runs, since a task file with no row is a dropped task and placing the row is the controller's call.

The guard names the worker alone, because a planner closing a groundwork track files through the same Create path and reaches Step 4's roster check. A stop in Step 4 would have blocked that planner too.

### Board and backlog

The three readiness groups say whether a task can start, which is mechanical. Nothing in them says which task is worth starting, and past a few dozen unplanned rows that judgment stops fitting in one reading.

Row position under `## Needs a plan` carries it, and `backlog.md` holds what is not near-term. The backlog is not a fourth readiness group, which the standard bars because the three names are a contract anything counting rows reads by. It states that nobody has scheduled the task, a fact about attention rather than about whether the work can start.

- **Why a backlog.** State shifts under a row ten deep, so planning it now is wasted. A board row claims a commitment nobody made, where a backlog line costs a pointer.
- **Why not the intake folder.** Intake holds findings before anyone decides they are work. The backlog holds decisions already taken that nobody has scheduled.
- **The cost.** A judgment restated on every sweep. A mechanical test over age or origin would predict nothing about what gets picked, so the cost is taken, and the `role-orchestrator` sweep pays it.

### Leaving the backlog

The sweep only lifts a row onto the board. `backlog-triage` takes one off, filing a verdict per row into an intake folder and applying the ones the operator approved.

`canon tasks decline` drops a task's line from `priority.md` and `backlog.md` alike. `canon tasks archive` drops only the `priority.md` row, so a caller archiving straight off the backlog removes the line itself once the archive succeeds.

### Sequencing and in-session work

Sequencing rationale rides in the `Waiting on` cell, one line per row. Why one group runs before another is carried by no surface, so a session wanting it asks whoever ordered the board.

- Work too small to plan that is executing in the filing session fits no group. `## Run now` requires a plan, and the backlog says nobody scheduled the task.
- The row takes `## Needs a plan` with the mismatch stated in its `Waiting on` cell, which costs less than a fourth group the standard bars

### Validating a row

`canon tasks validate` checks what a row claims once the sweep has rewritten it. It is a verb rather than a hook because the board is per-machine scratch, so a `PostToolUse` hook would fire on intermediate states mid-restructure and run only in an interactive session.

It reads and never writes. A row is the orchestrator's claim about readiness, and a validator repairing one would assert the claim it exists to test.

### File-set overlap

The check earning its place is overlap between `## Run now` rows, the part of the dispatch conflict test a person cannot run by eye. The validator lists those pairs in a `shared` array that moves no exit code.

A collision finding exiting 2 was retired. Once the gate held on a dependency, a contract, a relocation, a sweep, or a stated reason alone, it failed every sweep on a canvas doc two independent rows both wrote, and a `Touches` cell cannot say which hold a pair carries.

### Blockers

A blocker cell is a measurement taken the day a row was parked. Two of its five kinds put a fact on disk, and both are inputs the validator already reads.

- A cited task is settled by being archived, declined, or reaching the trunk
- A cited file is settled by nothing under `## Run now` still holding it
- A citation resolving in none of the three is `blocker-unresolved`, since an absent file read as archived states a fact about a file nobody wrote, as a renamed task or a typo produces

Reaching the trunk is what a closed checkbox cannot answer, since `task-complete` ticks outcomes several steps before `git-pr` opens the pull request. The check reads the task's `Pull request:` line, and `src/tasks/trunk.ts` asks whether a commit naming that number sits on `origin/main`, falling back to local `main`.

- A task that closed every outcome and names no pull request goes to the untested array, as does one no trunk ref could answer for
- Degrading either back to the box reproduces the false settle under a name claiming to have fixed it
- The reader never fetches, since the verb runs several times a sweep. A clone behind its remote under-reports a settled row, so a session that has not pulled sees parked rows it could have released.

The three kinds resting on judgment go to a second array, because a check reporting only what it can settle is trusted past its reach. The untested array keeps the reach visible without moving an exit code.

### The cell stays prose

The board standard fixes three forms for a blocker cell and leaves it unstructured, and the check reads citations out of it. A cited task is a bare sibling link, so a pointer into another folder is a plan and settles nothing. A grammar for a handful of rows nobody phrases the same way twice was the rejected alternative.

Both halves gate on the cell rather than a column beside it. Gating collision on the row's `Touches` column fires on any parked row whose declared files nothing running holds, whatever parked it. That row then counts as re-tested, so the condition still holding it goes unmentioned and the report reads as a clean board.

### Mapping

The mapping check counts a task file against both the board and the backlog. Counting against the board alone fails every run on a backlogged task, with each finding correct.

A marker inside the task file would put the fact in two places, where the backlog line already says it. One check across both surfaces lets a task move between them without looking like a dropped file, and a task named by both is reported as a task in two groups is.

### The filing boundary

Filing a row states the defect and the surface it was seen on and stops, leaving the extent and the cause to whoever plans it. A row carrying a count reads as measured, so a planner inherits a scope nobody outside the orchestrating seat could check.

The cause half costs more. A wrong count fails at the first re-measurement, and a wrong mechanism nobody opened the module to check sends real work the wrong way.

- A flat ban on measuring contradicts `orchestrator-parked.md`, refill step 6, and `### Writing the board`
- What separates the kinds is what the measurement decides. A blocker re-test, a collision check, and a file set decide whether a row can start.
- A count of extent sizes the row, which this seat has no vantage to do
- A position claim in a `## Needs a plan` cell may name the row it outranks and its class, and may not cite a count of extent to justify the rank

The statement lives once in `claude/skills/role-orchestrator/SKILL.md` under `## Boundaries`. The sibling `REQUIREMENT.md` carries it as a `Must not`, and `orchestrator-parked.md` points at it.

The task standard carries no matching convention, since it would bind a groundwork or intake pass that measured properly before filing. No gate stage enforces the rule, so the next row filed shows whether it holds.

## Gotchas

### Board findings decay

Nothing in git records when a board finding stopped being true, and a count can decay upward as well as dead. A re-measurement can find far more instances than a task file states, or far fewer.

- Re-measure before executing rather than trusting the file
- Where a plan converts a stale count into a scope constraint, the constraint caps the work below the outcome it serves, and the outcome wins
- A finding about live external state needs a query rather than a grep, since routine cleanup may already have swept the state away
