---
title: Board
description: Why the board is one orchestrator's gitignored scratch, the split between the board and the backlog, what canon tasks validate checks on a row, and where filing a row stops
---

# Board

## Board constraints

Gitignored also means undated. `git log --diff-filter=A` over `.canon/groundwork/`, `.canon/intake/`, `.canon/plans/`, or `.canon/tasks/` returns nothing at all, since no commit ever touched those paths, so a pass reconstructing when a folder opened has only what the file wrote down itself. Filesystem mtime is the wrong substitute, because it records the last edit and reads later than the truth on anything still being worked. A surface that wants a recoverable opening date carries it as a frontmatter field, which is why `standards/groundwork.md` and `intake.md` both require one.

Both artifacts are gitignored, which limits the board to one orchestrator at a time. A second session reads neither the other's task files nor its archives, so the two write colliding labels and archive each other's plans. `role-orchestrator` states the constraint, holds the queue-refill sweep that keeps planned, non-conflicting tasks ahead of a free worker, and states the method for writing `priority.md` under Writing the board, since the sweep promotes and demotes rows. `canon tasks archive` removes a row on merge, and `task-board` and `plan-groundwork` each write one directly in the roster-checked fallback, when no live orchestrator is there to hand the row to.

Being gitignored also puts the citations these artifacts carry outside every check. A task file names its origin as a `Groundwork:` or `Plan:` link, `priority.md` carries a plan link per row, and a memory entry names archive paths in its `How to apply:` line. None of those appear in a diff, the citation half of `canon context audit` covers `canon/context/` alone, and no drift stage reads the folder, so a path rename anywhere under `.claude/` has to sweep the board and the memory folder by hand or it ships with every pointer broken and each check still green.

## Board and backlog

The three readiness groups answer whether a task can start, which is mechanical and checkable. Nothing in them answers which task is worth starting, and once unplanned rows number in the dozens that judgment stops fitting in one reading, so the board cannot say what to do next.

Row position under `## Needs a plan` carries that judgment, and `backlog.md` holds what is not near-term. A fourth readiness group is the obvious shape and the standard bars it directly, since the three names are a contract anything counting rows under a heading reads by. The bar holds on its own terms here: a backlog states that nobody has scheduled the task, which is a fact about attention rather than about whether the work can start, so it is not a readiness group whatever it is called.

Sorting the whole group and leaving it on the board is the alternative the cut declines. State shifts under a row sitting ten deep, so planning it now is wasted, and carrying it as a board row claims a commitment nobody made. A backlog line costs a pointer where a board row costs a position, a rationale, and a slot in every count. The intake folder was the third candidate and it holds findings before anyone decides they are work, while these are decisions already taken that nobody has scheduled.

The split costs a judgment restated on every sweep rather than a rule applied once. A mechanical test over age or origin would need no restating and predicts nothing about what gets picked, which is the whole thing the ordering exists to carry, so the cost is taken deliberately and the sweep in `role-orchestrator` is where it is paid.

Sequencing rationale has no dedicated home. It rides in the `Waiting on` cell the row already carries, one line per row. A separate document would be that surface under another name. The cell holds one row's reasoning and nothing wider: why one group of work runs before another is carried by no surface at all, which the tasks standard states, so a session wanting it asks whoever ordered the board.

The three groups have no slot at the other end either, for work too small to plan that is executing in the session filing it. `## Run now` requires a written plan covering every open outcome, so a change agreed as a diff in conversation cannot enter it, and the backlog asserts that nobody has scheduled the task, which is false of work already running. Such a row takes `## Needs a plan` with the mismatch stated in its own `Waiting on` cell, on the reading that a row contradicting its heading for the minutes before a merge clears it costs less than a fourth group the standard bars.

## Validating a row

`canon tasks validate` checks what a row claims once the sweep has rewritten it. It is a verb rather than a hook because the board is gitignored per-machine scratch, so a `PostToolUse` hook would fire on intermediate states mid-restructure and run nowhere but an interactive session. It reads and never writes, since a row is the orchestrator's claim about readiness and a validator repairing one would assert the claim it exists to test.

The check it earns its place on is file-set overlap between `## Run now` rows. That group's test has a plan half and a half asking whether the task carries a reason it cannot start, and a collision against what something already running touches is one such reason, which is the part a person cannot run by eye.

### Blockers

The blocker check reaches the opposite groups on the same argument. A blocker cell is a measurement taken the day a row was parked, and two of the five kinds it carries put a fact on disk: a cited task is settled by being archived, by being declined, or by reaching the trunk, and a cited file is settled by nothing under `## Run now` still holding it. Both are inputs the validator already reads for the other four checks.

Reaching the trunk is the check the closed checkbox cannot answer. `docs-fold` marks outcomes as step one of the ship chain and `git-pr` opens the pull request several steps later, so a checkbox alone can read a row as settled while its branch still sits in review. The check reads the task's `Pull request:` line instead, and `src/tasks/trunk.ts` asks whether a commit naming that number sits on `origin/main`, falling back to local `main`. A task that closed every outcome and names no pull request goes to the untested array, as does one whose number no trunk ref could answer for. Degrading either back to the box is forbidden, since it reproduces the false settle under a name claiming to have fixed it.

The reader never fetches. `canon tasks validate` runs several times a sweep, so a clone behind its remote under-reports a settled row rather than claiming work landed. The trade is that a session that has not pulled sees parked rows it could have released.

### The cell stays prose

The cell stays prose and the check reads citations out of it, which is the constraint the board standard sets by fixing three forms for the cell and leaving it unstructured. A cited task is a bare sibling link, so a pointer into another folder is a plan and settles nothing. Parsing the cell into fields was the alternative and it writes a grammar for a corpus of a handful of rows nobody phrases the same way twice.

Both halves gate on the cell rather than on a column beside it. Gating the collision half on the row's own `Touches` column is the alternative, and it fires on any parked row whose declared files nothing running holds, whatever parked the row. The false finding is the cheaper half of that error: the row also counts as re-tested and drops out of the untested list, so the condition still holding it goes unmentioned and the report reads as a clean board. The standard gives a collision cell the file held by the running task, so the citation is already there to gate on.

A citation resolving in none of the three is `blocker-unresolved` rather than a settled row. Reading an absent file as archived or declined states a specific fact about a file nobody wrote, which is what a renamed task or a typo produces, and only a task that genuinely closed or was genuinely decided against releases the row.

The three kinds resting on judgment go to a second array rather than to the findings, because a check reporting only what it can settle is trusted past its reach. A clean findings list on a board whose parked rows were never testable reads as a clean board, so the untested array keeps the reach visible without moving an exit code.

### Mapping

The mapping check counts a task file against both the board and the backlog. Counting against the board alone reports a row and a task file that do not map one to one, which is exactly the state a backlogged task is in, so every run would fail with each finding correct. Reading a marker inside the task file was the alternative and it puts the same fact in two places, where the backlog line already says it. One check across both surfaces also lets a task move between them without the move looking like a dropped file, and a task named by both is reported for the reason a task in two groups is.

## The filing boundary

Filing a row states the defect and the surface it was seen on and stops, leaving the extent and the cause to whoever plans the row. A row carrying a count reads as measured, so a planner inherits a scope nobody outside the orchestrating seat could check. The cause half is the more expensive one: a filed row can assert a mechanism nobody opened the module to check, and a wrong count fails loudly at the first re-measurement where a wrong mechanism sends real work in the wrong direction.

A flat ban on measuring was the alternative and it contradicts three live rules at once, since `orchestrator-parked.md` orders a tree condition re-measured, refill step 6 orders a candidate's file set listed against every track in flight, and `### Writing the board` orders that set written into the `Touches` column. What separates the two kinds is what the measurement decides rather than whether one was taken. A blocker re-test, a collision check, and a file set decide whether a row can start, and a count of a defect's extent decides how big it is, so only the second commits a plan to a scope this seat has no vantage to size.

A position claim in a `## Needs a plan` cell falls inside the boundary rather than beside it. It may name the row it outranks and the class it belongs to, both of which are judgments about order, and it may not cite a count of the defect's extent to justify the rank. Leaving the two surfaces to settle it separately was the alternative, and it hands whichever lands second a cell whose ranking vocabulary reaches for the number the other one bans.

The statement lives once in `claude/skills/role-orchestrator/SKILL.md` under `## Boundaries`, with the sibling `REQUIREMENT.md` carrying it as a `Must not` and `orchestrator-parked.md` pointing at it, since that runbook's re-test would otherwise read as an instruction to size a row from this seat. The task standard carries no matching convention, because the rule is seat-scoped and a standard governing every task file would bind a groundwork or intake pass that measured properly before filing. Nothing enforces any of it, since no gate stage reads a skill body for the rule, and whether it holds is read off the next row filed.

## Gotchas

### Board findings decay

Board findings decay silently, because the board is gitignored and nothing in git records when a finding stopped being true, and a count can decay upward as well as dead: a re-measurement can find far more instances than a task file states, or far fewer. Re-measure before executing rather than trusting the file. Where a plan converts a stale count into a scope constraint, the constraint caps the work below the outcome it serves and the outcome wins. A finding about live external state needs the same check by query rather than by grep, since a query against live state can answer differently from what a task file recorded, especially where routine cleanup has already swept the state away.
