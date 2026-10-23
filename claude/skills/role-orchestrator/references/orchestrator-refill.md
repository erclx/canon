---
title: Orchestrator refill runbook
description: The queue-refill procedure run after a merge, on a thin ready list, or mid-wave, its report, and the rules for writing the board
---

Run this when `## Refilling the ready queue` in the skill body names one of its three triggers. `orchestrator-sweep.md` wraps it for a batch of merges and adds the plan re-verification that a merge invalidates.

## The mid-wave trigger

The third trigger reaches a window the first two cannot. A session with three workers mid-build has merged nothing and watched its ready list sit still, so both reactive triggers stay silent across the one stretch where planning costs nothing, and the wave finishes into an empty `## Run now`.

- Nothing starts this pass, as nothing starts the review poll, so it holds only while the session applies it
- It counts unclaimed plans against workers rather than reading step 4's reserve, which is sized for one worker finishing and falls short of a wave landing together
- A plan a worker already took serves nobody who finishes next, so counting it lets the queue read full while it is about to empty
- How many to write past that floor is the parallelism call rather than a count of free slots, and `## Parallelism` in the skill body states what binds it

## Running the refill

1. Run `gh pr list --state open` and `git log --oneline -8`. Report any pull request whose review has not been posted and stop for that one first.
2. For each pull request merged since the last sweep, place every finding it produced, and never leave one in a pull request thread alone.
   - A finding that changes a rule goes to the standard or rule that states it
   - One that changes another task goes to that task's Findings, and one that overturns a groundwork lean to that folder marked answered
3. Archive what closed.
   - A task whose outcomes are all `[x]`, or all `[x]` beside `Operator check:` lines, and whose pull request merged is archived by the `post-merge` hook through `canon tasks archive`, plans included
   - Run `task-complete` to archive one the hook left in place
   - A task whose outcomes are standing policy never closes, so hand it to a worker to encode the policy where it is enforced, then cut the outcomes with the reason and archive once that branch merges
   - Encoding it from this session would write a tracked file, which `## Boundaries` in the skill body forbids
   - An outcome marked `- [ ] Operator check: <outcome>` never blocks the archive. The hook prints no record, so read the archived file's `Operator check:` lines into the report's `Operator checks:` line and leave them unticked.
   - A merged task whose only open outcomes another repository owes, or that an operator owns and nobody marked, never archives, since `canon tasks archive` refuses `open-outcomes`. Strike each one on the task file as `- ~~<outcome>~~ <reason>`, with the reason on the same line, then archive. The task files are gitignored scratch, so this session may edit them.
   - Strike only an outcome the operator or another repository owes. An open outcome this repository owes stays on the board, and the task stays with it.
   - Send a struck outcome that another repository owes to that repository's orchestrator through `session-relay`, which resolves the address, and let the receiver file it with `task-board` on its own board. `task-board` here would file it on this board. Name it in the report for the operator when no such session is live.
   - List every struck outcome in the report's `Struck:` line, so the work is carried by a named owner rather than lost to the strike
4. Read `.canon/tasks/priority.md` and count the `## Up next` rows whose `Waiting on` has cleared, since a blocked row is no reserve. `## Run now` is what is running, so keep one in reserve beyond it.
5. Promote from the top of `## Needs a plan`, where the last sweep recorded what to plan next.
   - Depart from that order when something changed under it and say what, since a position nobody honors is the ordering going stale
   - The order is set by whether a task establishes functionality, so prefer one that adds or proves a mechanism over one that trims, tidies, or audits
   - Re-take the demotion half of the board-or-backlog call while the file is open, moving a row no longer near-term to `backlog.md` per the standard's test
   - The promotion half is `orchestrator-parked.md`'s full walk over every backlog row, and a row it clears already sits at the bottom of `## Needs a plan`
6. Before promoting a candidate, test it against every running task under the conflict check in `orchestrator-dispatch.md`.
   - Serialize it behind a task only on one of that check's holds, and name the hold
   - A path the two merely share is promoted beside it, named so the merge order plans the rebase
   - A candidate held by something outside the tree stays put whatever the check shows, since clearing a conflict leaves an external condition standing
7. Write a plan for each newly promoted task with `plan-feature`, carrying the in-flight constraint that `## The loop` in the skill body states, then report:

```plaintext
Findings placed: <finding> → <destination>
Archived: <task>
Struck: <outcome>, owed by <operator or repository>, <reason>
Operator checks: <outcome>, left unticked on <task>
Promoted: <task>, touches <surfaces>, parallel with <task>, sharing <paths or none>
Serialized: <task> behind <task>, held on <dependency, contract, relocation, sweep, or reason>
Backlogged: <task>, because <what stopped being near-term>
Ready now: <tasks with plans, and what each waits on>
```

That block is the detail. Lead the reply with the three slots under `## Every later turn` in `orchestrator-output.md`, so the human reads what they own before the evidence for it.

- A task editing `canon/context/` entries wholesale is a sweep under the conflict check and holds every other task, since the root instruction file requires each task to update its own domain entry
- Do not promote a task to fill the queue when nothing qualifies. A thin queue is a real answer and it beats a plan nobody needed.

## Writing the board

Write `.canon/tasks/priority.md` through the `canon tasks` verbs alone, each reading the file once, rendering every table, and writing it once. Beside this session, `canon tasks archive` drops a shipped row and `plan-link` promotes a parked one.

| Move                                      | Verb                                                       |
| ----------------------------------------- | ---------------------------------------------------------- |
| A backlog row onto the board, or across   | `canon tasks place <stem> --group <group> --waiting "..."` |
| A planned row to `## Run now` on dispatch | `canon tasks promote <stem>`                               |
| A row up or down inside its group         | `canon tasks move <stem> --before <stem>`                  |
| What a row waits on, or why it sits there | `canon tasks block <stem> "<reason>"`                      |

Four verbs cover every move the board takes, and the points below hold for all four.

- `place` removes the task's backlog line in the same call, so a row never sits on both surfaces or on neither
- Demoting a row to `backlog.md` has no verb yet. Add the backlog line first, then delete the row with the file-editing tool, which errors on a non-match.
- Put the reason a row sits where it does in its Waiting on cell through `block`, since a row promoted with the cell left alone carries an order the next sweep cannot check
- Run `canon tasks validate` after any move, which reports a hand edit the verbs would have refused

### Columns and read-back

The verbs derive the Task, Touches, and Plan cells from the task file and its live plans, so a later reader checks them rather than reasoning again.

- `place` and `promote` refuse a row the target group's test fails, so a Plan cell never leads `auto-ship` to no plan and spends a dispatch
- A Touches cell differing from its plan's list is `touches-stale`. Change the plan's list rather than the cell, and step 6's hold call reads the result.
- Read the board back after a write, since the row that lands is the row a worker acts on

### Stale plan pointers

A Plan pointer goes stale from a merge this board never sees. The `post-merge` hook moves a plan to `.canon/plans/archive/` through `canon tasks archive` and rewrites the citation in the archived task file alone.

- A row for a task still on the board keeps pointing into `.canon/plans/` at a file that has moved, until the next verb call re-derives every Plan cell from the live plans
- `task-complete` marks outcomes on each worker's branch and moves nothing, so the move lands at the merge
- The board then reads as correct until a pointer is followed
