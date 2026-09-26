---
title: Orchestrator refill runbook
description: The queue-refill procedure run after a merge, on a thin ready list, or mid-wave, its report, and the rules for writing the board
---

Run this when `## Refilling the ready queue` in the skill body names one of its three triggers. `orchestrator-sweep.md` wraps it for a batch of merges and adds the plan re-verification that a merge invalidates.

The third trigger reaches a window the first two cannot. A session with three workers mid-build has merged nothing and has watched its ready list sit still, so both reactive triggers stay silent across the one stretch where planning costs the session nothing, and the wave finishes into an empty `## Run now`. Nothing starts this pass, in the way nothing starts the review poll, so it holds only while the session applies it.

It counts unclaimed plans against workers rather than reading the reserve in step 4, which is sized for one worker finishing and falls short of a wave landing together. A plan a worker has already taken serves nobody who finishes next, so counting it is what lets the queue read full while it is about to empty. How many to write forward past that floor is the parallelism call rather than a count of free slots, and `## Parallelism` in the skill body states what binds it.

## Running the refill

1. Run `gh pr list --state open` and `git log --oneline -8`. Report any pull request whose review has not been posted and stop for that one first.
2. For each pull request merged since the last sweep, place every finding it produced. Route a finding that changes a rule to the standard or rule that states it, one that changes another task to that task's Findings, and one that overturns a groundwork lean to that folder marked answered. Never leave a finding in a pull request thread alone.
3. Archive what closed.
   - A task whose outcomes are all `[x]` runs `context-fold` for the plan sweep, then `task-board` to archive
   - A task whose outcomes describe standing policy rather than a deliverable never closes on its own, so hand it to a worker to encode the policy where it is enforced, then cut the outcomes with the reason recorded and archive once that branch merges. Encoding it from this session would write a tracked file, which `## Boundaries` in the skill body forbids.
4. Read `.canon/tasks/priority.md` and count entries under its `## Run now` heading that carry a written plan. Keep one in reserve beyond what is running.
5. Promote from the top of `## Needs a plan`, which is where the last sweep recorded what to plan next. Depart from that order when something has changed under it and say what changed, since a position nobody honors is the ordering going stale on the surface built to hold it. What sets the order in the first place is whether a task establishes functionality rather than how old it is, so prefer a task that adds or proves a mechanism over one that trims, tidies, or audits an existing surface.
   - Re-take the demotion half of the board-or-backlog call while the file is open. A row that has stopped being near-term moves to `backlog.md`, one line removed from `priority.md` and written there, per the standard's test. The promotion half is `orchestrator-parked.md`'s to run as a full walk over every backlog row, so this step does not repeat it. A row that pass clears already sits at the bottom of `## Needs a plan` before this sweep reads the heading.
6. Before promoting a candidate, list the files it touches against every task already running, per `## Parallelism` in the skill body. Name the overlap and serialize when the sets are not disjoint.
   - A candidate held by something outside the tree stays where it is whatever those sets show. A collision is one of the reasons a task cannot start, so disjointness clears that reason alone and leaves an external condition standing.
7. Write a plan for each newly promoted task with `plan-feature`, carrying the in-flight constraint that `## The loop` in the skill body states, then report:

```plaintext
Capture: owed since <the last handoff, or session start when none has run>
Findings placed: <finding> → <destination>
Archived: <task>
Promoted: <task>, touches <surfaces>, parallel with <task> because <disjoint sets>
Serialized: <task> behind <task>, both write <file>
Backlogged: <task>, because <what stopped being near-term>
Ready now: <tasks with plans, and what each waits on>
```

The capture row states a standing debt rather than a per-run result. Running capture from here costs the operator a pass between merges while nothing ships, so the row leaves the timing to them and dates the debt, since a capture owed for twenty minutes and one owed all day want different answers and undated text reads the same either way. `orchestrator-handoff.md` holds the step that pays it.

That block is the detail. Lead the reply with the three slots under `## Every later turn` in `orchestrator-output.md`, so the human reads what they own before the evidence for it.

Treat a task that edits `canon/context/` entries wholesale as conflicting with every other task, because the root instruction file requires each task to update its own domain entry as it lands.

Do not promote a task to fill the queue when nothing qualifies. A thin queue is a real answer and it beats a plan nobody needed.

## Writing the board

Promoting, demoting, and archiving a row all write `.canon/tasks/priority.md`, and this session is the only writer apart from `canon tasks archive`. Moving a task between the board and `.canon/tasks/backlog.md` writes both files, and this session is that file's only writer.

- Edit the file with the file-editing tool. A shell stream editor and an inline string replace both exit clean on a non-match, so a promotion that matched nothing leaves the board wrong with nothing reporting it, and the file-editing tool errors instead.
- Write both halves of a move before reporting it. A row removed from one surface and not written to the other leaves a task file nothing names, and the folder is gitignored with no history to recover the row from. `canon tasks validate` reports that state, so run it after any move.
- Put the reason a row sits where it does in its Waiting on cell. Position is the ordering and the cell is where the ordering's rationale lives, so a row promoted with the cell left alone carries an order the next sweep cannot check.
- Put a pointer in the Plan column, never prose. `## Run now` claims a written plan covers every open outcome, and `auto-ship` refuses at its guard when it follows the column and finds no plan, which spends a worker dispatch to learn what the row should have said.
- Name the file set in the Touches column. The disjointness call in step 6 is only checkable later when the sets are written down rather than reasoned once and discarded.
- Re-resolve every Plan pointer after anything archives a plan
- Read the file back after writing it, since the row that lands is the row a worker acts on

A Plan pointer goes stale from a branch this board never sees. `context-fold` moves a plan to `.canon/plans/archive/` and rewrites the citation in the task file alone, so a row for a task still on the board keeps pointing into `.canon/plans/` at a file that has moved. Workers running the ship chain on their own branches archive plans this board still cites, and the board reads as correct until a pointer is followed.
