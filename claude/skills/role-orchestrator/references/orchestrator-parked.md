---
title: Orchestrator parked row runbook
description: Re-testing every parked blocker against the current tree, the two triggers that start the pass, and the two ways a re-test goes wrong
---

Re-test every parked row as orchestrator. A blocker cell is a measurement taken the day the row was parked and nothing re-takes it, so a row can wait on a condition that stopped holding weeks earlier with no surface reporting the gap.

## Triggers

Two triggers start this pass, and they differ in scope rather than in procedure.

| Trigger                                                                                           | Scope                                                                                                                                |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `orchestrator-sweep.md` sends the rows `canon tasks validate` listed untested                     | Those rows alone, since a merge changes the tree under every parked row and the validator already re-took the two kinds it settles   |
| An idle session, with nothing merged, workers building, and no pull request awaiting a first pass | Every parked row, since no event narrowed them, plus every `backlog.md` row, which carries no blocker cell for the validator to name |

- Neither trigger is a scheduler. `orchestrator-poll.md` owns the one recurring trigger, and a second loop firing into a static board is the always-on failure it warns about.
- The sweep asks which parked row to promote next, taking the blocker cell as read, and this pass asks whether the cell is still true
- A session collapsing the two runs whichever it remembers and re-tests nothing

## Scope

Every row under `## Up next` and `## Needs a plan` in `.canon/tasks/priority.md`, plus every row in `.canon/tasks/backlog.md` on the idle trigger when the file exists. A `## Run now` row carries no blocker, so the pass skips it. Resolve the board, the backlog, and each task file at the main worktree root, the way `session-worktree` does.

- Take the board rows in board order and finish one before opening the next, since clearing a row changes what the next row holds behind
- A pass that measures every row first and writes afterwards writes against a board it has already invalidated
- On the idle trigger, walk the backlog after the board in filename order, since `${CLAUDE_SKILL_DIR}/../task-board/references/board.md` fixes it as unordered

## Re-testing a row

The blocker cell states what the row waits on, and each kind is tested differently. `canon tasks validate` already re-takes the first two and reports the rest as untested, so run it first and re-take by hand only what it names.

### A hold behind a track in flight

The validator tests the file the cell cites against the files every `## Run now` row's plans declare. A track that merged since the row was parked is no longer in flight, whatever the sets still share.

- Re-test the cell under the conflict check in `orchestrator-dispatch.md` too, since a row parked on a shared file alone holds on nothing and moves up
- A cell naming the file in prose rather than backticks cites nothing, so rewrite the hold in the board's spelling and the next run picks it up

### A dependency on another task

The validator opens the task a link in the cell names. One whose outcomes are all `[x]`, one already archived, or one already declined holds nothing. A cell naming the task in prose resolves to no file, so open it by hand and rewrite the cell as a link.

### The other three kinds

These the validator reports untested, and each takes its own handling.

- A condition about the tree, such as a count of some shape or the presence of a construct: measure it again, per Two ways a re-test goes wrong below.
- Waiting on a plan: nothing external holds the row, so the pass writes the plan rather than testing anything. See The plan half below.
- Waiting on an operator action, such as a run from a shell: record it as untestable this pass and name what the operator has to do, since re-measuring it is waste

### Writing the result

Every measurement this pass takes decides whether a row can start rather than how big it is. Sizing a row is the filing boundary `role-orchestrator` states under `## Boundaries`, which leaves the extent and the cause to whoever plans it.

Write the result into the row, since a re-test reported in chat is lost at the next compaction and measured again.

- Rewrite a blocker cell whose test no longer holds through `canon tasks block <stem> "<blocker>"`, and move the row to the group its new state puts it in through `canon tasks place`
- Record the measurement in the task's `## Findings` as a line labeled with this session and the date, per `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md`
- `### Writing the board` in `role-orchestrator` owns the method, and `canon tasks validate` runs once the board is rewritten and before the report

## Re-testing a backlog row

A backlog row carries no blocker cell, since `${CLAUDE_SKILL_DIR}/../task-board/references/board.md` fixes `backlog.md` as a flat list of links with no state of its own. This pass asks the standard's board-or-backlog question instead, whether the work in front of the row landed or the world changed under it.

- Read the answer from the task file's `## Findings` and its origin line, `Plan:`, `Groundwork:`, `Intake:`, or `Issue:`
- Clearing a row answers yes, never a count of how long it waited, since age is refused as evidence here on the same ground as for a board row
- This pass only clears a row upward. Declining or archiving a backlog row is `backlog-triage`.

### Moving a cleared row

A cleared row moves out of `backlog.md` onto the bottom of `## Needs a plan` in one call, `canon tasks place <stem> --group needs-a-plan --bottom --waiting "<what changed>. Last"`.

- `canon tasks validate`'s ordering check reads `last` as the ordinal the bottom placement claims
- A cell stating only what changed matches neither the ordinal nor the rank reading, raising a finding against the pass's own row
- The next refill sweep's promotion step still orders the row against the rest of that heading, per step 5 under `## Refilling the ready queue` in `role-orchestrator`

## Two ways a re-test goes wrong

Both return a confident wrong answer rather than an error, which is why each gets a step of its own.

### Reading the condition looser than the code

A row parked on a count of some shape names a shape its consumer defines precisely, and a count by eye or by an approximate pattern lands elsewhere. The row that motivated this runbook counted 19 instances of a shape whose real count under the consumer's definition was zero.

Find the code that consumes the shape, read the definition off it, and measure with that. A count taken any other way is not evidence about the blocker.

### Measuring against the wrong tree

A command that ships to targets is at risk in corpora this repository never formats, so a condition measured here reads as unreachable while it stays live where the command runs. Ask which tree the condition is about before asking what the count is.

A local formatter removing the shape on contact says nothing about a target running no such formatter.

## The plan half

Plan what the pass clears, and any `## Needs a plan` row whose only blocker is the missing plan. This pass runs while workers build and the session is idle, when planning costs the critical path nothing, and a row cleared with no plan is looked at again next pass.

- Run `plan-feature` for each, carrying the constraint per in-flight track that `## The loop` in `role-orchestrator` requires
- Verify each plan against the tree the way that step does, since several branches are already changing it
- Stop where `## Parallelism` stops, since a plan the conflict check holds behind every track in flight is one nobody can dispatch
- Do not restate the refill procedure. `orchestrator-refill.md` owns it, so this pass promotes through that method.

## Two results that are not a re-test

Neither result below justifies moving a row.

- Age is not evidence. `role-orchestrator` refuses to promote a task to fill the queue, so a row whose blocker still holds stays, reported as still parked against this pass's measurement.
- A scoping defect can wear a blocker. A task conflicting with every other through a contract everything consumes or a sweep over everything is oversized, not blocked.
- Split such a task so each piece holds behind fewer tracks, since planning it again produces the same undispatchable plan
- A task that merely shares files with everything is not this case

## Output

```plaintext
Re-tested: <row>, <blocker> → <what the measurement showed>
Cleared: <row>, now <group>, plan at <path>
Declined: <row>, waited on <task> which was declined, now <group>
Still parked: <row>, <blocker> re-confirmed against <what was measured>
Untestable: <row>, waits on <operator action>
Split: <task> into <tasks>, conflicted with everything by contract or sweep
Backlog cleared: <row>, now bottom of ## Needs a plan, waiting on <what changed>
Still backlogged: <row>, <what was checked> found unchanged
```

Omit any row with nothing in it. Name what was measured rather than the verdict alone, since a re-test the reader cannot check is the same claim the row already carried.

Lead the reply with the three slots under `## Every later turn` in `orchestrator-output.md`, so the human reads what they own before the evidence for it.
