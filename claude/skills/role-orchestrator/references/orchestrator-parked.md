---
title: Orchestrator parked row runbook
description: Re-testing every parked blocker against the current tree, the two triggers that start the pass, and the two ways a re-test goes wrong
---

Re-test every parked row as orchestrator. A blocker cell is a measurement taken the day the row was parked and nothing re-takes it, so a row can wait on a condition that stopped holding weeks earlier with no surface reporting the gap.

Two triggers start this pass. `orchestrator-sweep.md` ends by sending the rows `canon tasks validate` listed as untested here, because a merge changes the tree under every parked row at once rather than under the rows naming it. The other is an idle session: nothing merged, workers are building, no pull request is waiting on a first pass, and the board is not moving.

The two differ in scope rather than in procedure. A merge sends the untested rows, since the validator already re-took the two kinds it can settle. An idle session walks every parked row, because no event narrowed which of them to look at, and it alone also walks `backlog.md`: a merge names no backlog row as untested, since `canon tasks validate` re-tests blocker cells and a backlog row carries none.

Neither trigger is a scheduler. `orchestrator-poll.md` owns the one recurring trigger this skill has, and a second loop firing into a static board is the always-on failure that file already warns about.

The sweep's own question stays distinct from this one. It asks which parked row to promote next, taking the blocker cell as read, and this pass asks whether that cell is still true. A session collapsing them runs whichever it remembers and re-tests nothing.

## Scope

Every row under `## Up next` and `## Needs a plan` in `.canon/tasks/priority.md`. A `## Run now` row carries no blocker by definition, so the pass skips it. On the idle trigger, also every row in `.canon/tasks/backlog.md` when the file exists, per the trigger split above. Resolve the board, the backlog, and each task file at the main worktree root, the way `session-worktree` does.

Take the board rows in board order and finish one before opening the next. Clearing a row changes what the next row collides with, so a pass that measures every row first and writes afterwards writes against a board it has already invalidated. On the idle trigger, walk the backlog after the board, in the file's own filename order, since `${CLAUDE_SKILL_DIR}/../../standards/tasks.md` fixes that file as unordered and nothing about a row's position there means anything to preserve mid-pass.

## Re-testing a row

The blocker cell states what the row waits on, and each kind is tested differently. `canon tasks validate` already re-takes the first two and reports the rest as untested, so run it first and re-take by hand only what it names.

- Collision with a track in flight: the validator tests the file the cell cites against the Touches column of every `## Run now` row. A track that merged since the row was parked is no longer in flight, whatever the sets still share. A cell naming the file in prose rather than in backticks cites nothing, so write the collision the way the board format spells it and the check picks the row up on the next run.
- A dependency on another task: the validator opens the task a link in the cell names. One whose outcomes are all `[x]`, one already archived, or one already declined, holds nothing. A cell naming the task in prose resolves to no file, so open it by hand and rewrite the cell as a link.
- A condition about the tree, such as a count of some shape or the presence of a construct: measure it again, per Two ways a re-test goes wrong below.
- Waiting on a plan: nothing external holds the row, so the pass writes the plan rather than testing anything. See The plan half below.
- Waiting on an operator action, such as a run that happens from a shell: record it as untestable this pass and name what the operator has to do. A session cannot clear it, and re-measuring it every pass is waste.

Every measurement this pass takes is a blocker re-test on a row already filed, and it decides whether that row can start rather than how big it is. Sizing a row is the filing boundary `role-orchestrator` states under `## Boundaries`, which leaves the extent and the cause to whoever plans the row.

Write the result into the row. A re-test reported in chat is lost at the next compaction and the next pass measures the same thing again. Rewrite a blocker cell whose test no longer holds, move the row to the group its new state puts it in, and record the measurement in that task's `## Findings` with the date it was taken. `### Writing the board` in `role-orchestrator` owns the method, and `canon tasks validate` runs once the board is rewritten and before the report.

## Re-testing a backlog row

A backlog row carries no blocker cell, since `${CLAUDE_SKILL_DIR}/../../standards/tasks.md` fixes `backlog.md` as a flat list of links with no state of its own. The five kinds above test what a blocker names, and a backlog row names none, so this pass asks the board-or-backlog question the standard already states instead: has the work in front of the row landed, or has the world changed under it. Read the answer from the task file's own `## Findings` and its origin line (`Plan:`, `Groundwork:`, `Intake:`, or `Issue:`), which name what the row was filed against and whether the fact behind it still holds.

Clearing a row answers yes to that question. It is not a count of how long the row has waited: `## Two results that are not a re-test` below refuses age as evidence for a board row, and it refuses it here on the same ground, since a row untouched for weeks is not more clearable than one added yesterday.

A row this test clears moves out of `backlog.md` and onto the bottom of `## Needs a plan`, carrying a `Waiting on` cell that states what changed and ends with the word `last`. `canon tasks validate`'s ordering check reads `last` as the ordinal bottom placement already claims, and a cell stating only what changed matches neither that check's ordinal reading nor its rank reading, which raises the finding this pass would then have written against its own row. The next refill sweep's promotion step still orders the row against the rest of that heading the way it orders every other row there, per step 5 under `## Refilling the ready queue` in `role-orchestrator`.

## Two ways a re-test goes wrong

Both return a confident wrong answer rather than an error, which is why each gets a step of its own.

The first is reading the condition looser than the code defines it. A row parked on a count of some shape names a shape its consumer defines precisely, and a count taken by eye or by a pattern that approximates it lands somewhere else. The row that motivated this runbook counted 19 instances of a shape whose real count under the consumer's definition was zero.

Find the code that consumes the shape, read the definition off it, and measure with that. A count taken any other way is not evidence about the blocker.

The second is measuring against the wrong tree. A command that ships to targets is at risk in corpora this repository never formats, so a condition measured here reads as unreachable while it stays live where the command runs. Ask which tree the condition is about before asking what the count is. A local formatter removing the shape on contact says nothing about a target running no such formatter.

## The plan half

Plan what the pass clears, and plan any `## Needs a plan` row whose only blocker is the missing plan. The window is the argument: this pass runs while workers build and the session is otherwise idle, which is when planning costs the critical path nothing, and a row cleared with no plan is a row the next pass looks at again.

Run `plan-feature` for each, carrying the constraint per in-flight track that `## The loop` in `role-orchestrator` requires. Verify each plan against the tree the way that step does, since a plan written now is written against a tree several branches are already changing.

Stop where `## Parallelism` stops rather than planning every row the pass cleared. A plan whose file set collides with every track in flight is one nobody can dispatch.

Do not restate the refill procedure. `role-orchestrator` owns it under `## Refilling the ready queue` and `orchestrator-sweep.md` wraps it for a batch of merges, so this pass promotes through that method rather than a second one.

## Two results that are not a re-test

Age is not evidence. A row untouched for weeks invites promotion, and the waiting is not an argument for it. `role-orchestrator` refuses to promote a task to fill the queue and this pass inherits that refusal, so a row whose blocker still holds stays where it is. Reporting it as still parked, against a measurement taken this pass, is a result.

A scoping defect can wear a blocker. A task whose file set collides with every other task by construction is oversized rather than blocked, and planning it again produces the same plan nobody can dispatch. Split it into tasks with disjoint file sets, so the board stops carrying a row that re-measures the same way every pass.

## Output

```plaintext
Re-tested: <row>, <blocker> → <what the measurement showed>
Cleared: <row>, now <group>, plan at <path>
Declined: <row>, waited on <task> which was declined, now <group>
Still parked: <row>, <blocker> re-confirmed against <what was measured>
Untestable: <row>, waits on <operator action>
Split: <task> into <tasks>, file set collided with everything by construction
Backlog cleared: <row>, now bottom of ## Needs a plan, waiting on <what changed>
Still backlogged: <row>, <what was checked> found unchanged
```

Omit any row with nothing in it. Name what was measured rather than the verdict alone, since a re-test the reader cannot check is the same claim the row already carried.

Lead the reply with the three slots under `### Every later turn` in `role-orchestrator`, so the human reads what they own before the evidence for it.
