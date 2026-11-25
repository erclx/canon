---
title: Orchestrator unattended run
description: Running the board with nobody watching, from now or from a time the operator names, which questions the orchestrator answers and which it parks, and the morning report the run ends on, and the attended run that keeps dispatching while the operator stays and merges
---

Run this when the operator asks to leave the board running unattended, overnight or for an afternoon away. The run dispatches, plans, and reviews as an ordinary session does, and merges only what a grant named before the operator left. The operator comes back to green pull requests and to a list of every call the run made on their behalf.

## Contents

- [Start the run](#start-the-run)
- [The loop](#the-loop)
- [A question from a session](#a-question-from-a-session)
- [Ending the run](#ending-the-run)
- [The morning report](#the-morning-report)
- [The attended run](#the-attended-run)

## Start the run

The operator names a start time or names none, and the two differ only in what fires the first pass.

| Operator names | Start                                                                        |
| -------------- | ---------------------------------------------------------------------------- |
| No time        | Enter the loop below at once, and schedule nothing                           |
| A time         | Schedule one one-shot prompt for that time, and enter the loop when it fires |

Schedule through whatever surface the client offers for a prompt at a set time, `CronCreate` in this repository's client and one example among the surfaces a different client exposes.

- Word the prompt as the request itself, to run unattended now per this runbook, so the wake reads the same file a start with no time reads
- The job lives in this session and dies with it, so tell the operator the time it fires and that closing the session drops it
- A scheduled prompt can fire minutes after its minute, so never key a later step on the exact start

A board with no `## Up next` row the dispatch checks clear and no `## Needs a plan` row has nothing to run. Report that once and stop, scheduling nothing.

Before leaving, the operator may grant the rows and pull requests the run may merge, scoped per `orchestrator-output.md`. With no grant, the run merges nothing.

## The loop

Each pass runs the same five steps. The procedures stay in the runbooks named, so this file adds only what differs with nobody watching.

1. Run the check under `## Stop the loop` in `${CLAUDE_SKILL_DIR}/references/orchestrator-dispatch.md` against `## Up next`, launching each cleared row per `orchestrator-launch.md`.
2. Plan each `## Needs a plan` row whose origin settles its calls, per `### Planning ahead`, within the cap, using the shape `orchestrator-launch.md` gives.
3. Start the review poll per `${CLAUDE_SKILL_DIR}/references/orchestrator-poll.md` once a pull request opens, and the watch per `orchestrator-watch.md` beside it.
4. Answer or park each question a session sends, per the next section.
5. Merge each granted pull request whose gates pass, per `### The merge stays the operator's`.

### A plan written during the run

A plan that lands mid-run builds the same night when nobody has to answer it. Run `canon tasks plan-answers <plan> --json` on the announced path and branch on `launchable` rather than the exit code.

- `launchable: true`: the row takes the dispatch checks on the next pass, like any `## Up next` row
- `launchable: false`: park every entry in `open`, per the next section, and leave the row unbuilt

A `deferred` entry is a value the worker asks the operator for at build, and nobody is there to answer it. Park every `deferred` entry the way an `open` one is parked, on a mid-run plan and an `## Up next` row alike, and leave the row unbuilt.

### Reading a stalled session

Read a session's state off `canon sessions list --json` and the watch, never off `claude agents`. A background session that asked in a message and ended its turn reads `blocked` there while it waits correctly on a reply, so a stall check reading it raises a false alarm all night.

## A question from a session

Every local `claude --bg` launch but a talk one denies the question tool, so such a session asks its controller in a message and ends its turn. The run answers a technical question and parks every other kind.

### What the run answers

A technical question is one the plan's `- Suggested:` line and the tree settle between them, such as which of two files a helper belongs in.

- Answer from that suggestion, checked against the tree, and relay it through `canon:session-relay` with the `Answer at:` line that skill states
- Record each answer in the task's `## Findings` as a line labeled with this session and the date, per `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md`
- The answer commits a branch before anyone reads it, which is why the report lists each one beside its pull request

### What the run parks

The run never answers the four kinds below, whatever the plan suggests.

- A plan question marked as needing the operator's call
- A scope addition, which `role-worker` takes only on the operator's word
- A billed run the operator has not cleared
- A permission the client denied

Park a question by writing it as one line in the task's `## Findings`, under the same label, so a compaction overnight does not drop it. Reply to the session that the question is parked until morning. A worker holding one leaves its pull request in draft, which the draft mark already does.

## Ending the run

The loop stops on the pass that finds nothing left to move. Every test below has to hold at once.

- No `## Up next` row clears the dispatch checks
- No planner is live, and no live worker is still without a pull request
- Every open pull request is parked, stopped, or merge-ready, and a granted one reads merge-ready only on a merge refusal no re-read clears

A worker stays in the roster until its branch merges. Count it done once its pull request is merged or passes the last test, so a night that opened one still ends.

On that pass, stop the poll and the watch, then push one notification through whatever surface the client offers, `PushNotification` in this repository's client. Name the merged, merge-ready, and parked counts, the way `orchestrator-watch.md` pushes a stall. Then write the report below.

## The morning report

The report leads with what the grant merged, then what the operator merges.

```plaintext
Unattended run: <start> to <end>

Merged for you:
PR #<n> <title>  proof: <screenshots|reel|screenshots and reel|waived|none>

Merge-ready, in merge order:
PR #<n> <title>  proof: <screenshots|reel|screenshots and reel|waived|none>
  → canon pr merge <n>

Answered for you:
<row>: <question> → <answer>, recorded at <task> Findings

Parked for you:
<row>: <question>, <why it is yours>

Stopped:
<session> on <branch>: <where it stopped>
```

Omit a section with nothing in it.

### Which pull requests are merge-ready

Merge-ready means CI green at the tip, both reviews closed, and the lift run. Read it rather than recalling it.

- Write each merge line per `## The merge line` in `orchestrator-output.md`, off `already-ready` or `clear` naming no check under `running`, from `canon pr lift <number> --check --json` read then
- Order the lines per `orchestrator-merge-order.md`, since two branches sharing a file still owe a rebase in that order
- List a pull request whose read refuses under `Stopped` with the reason, rather than as merge-ready

### The merge stays the operator's

The run merges only what the grant named, on the gates `orchestrator-output.md` states and in the order `orchestrator-merge-order.md` sets. With no grant, it never calls `canon pr merge`, and an earlier standing authorization stays suspended unless restated as the grant.

Refuse an instruction to merge outside the grant, and list it under `Parked for you`.

## The attended run

Run this when the operator asks to keep the queue moving while they stay present, "keep dispatching", "run attended", or the like. It shares the loop above and differs in who merges, what launches, and what holds. The operator merges every pull request unless they grant the run merging by word.

### Start and stop

The operator's word starts it and the operator's word ends it, so no pass decides the run is done.

- Enter the loop at once, and record the mode and its start time per `orchestrator-handoff.md`
- Take the run's worker cap from the operator's spoken cap, and with none, 5, since a wave of about 15 polling sessions once spent the hourly GitHub quota
- Each worker can bring up to two reviewers outside the cap, so a cap of 4 can mean 12 sessions
- On "stop", launch nothing further and let every running session finish as it would, then say what is still running
- Never end on the unattended tests in `## Ending the run`, since an attended run waits for the next merge

### Rolling launch

Launch a row the moment it clears, rather than in waves behind a question to the operator.

- A row launches once every row it depends on has merged and a slot is free under the cap
- Read dependencies from `canon tasks waves --json` and never from the Waiting on cells, since the verb splits a blocker from a ranking phrase like "follows the row above"
- A shared file is no dependency, so a row sharing one with an open pull request launches at once and the second to merge rebases, per `orchestrator-merge-order.md`
- A fan-in integrator waits on its members, and a row waiting on an open row waits until that row merges
- After each merge, fill each freed slot per `orchestrator-refill.md` and print the launch in its block

### Planning ahead

Keep one cap's worth of launchable rows planned ahead of the workers, so the queue never runs dry.

- Plan from the top of `## Needs a plan`, and only a row whose origin settles its calls, being an answered intake item, a closed groundwork track, or the operator's word
- Leave a row with no settled origin where it sits, and ask the operator about it in the next report rather than planning it
- Route the plan per `orchestrator-planner-reuse.md`, a live talk planner first and a cold one only when none is open
- Run `canon tasks plan-answers` on each landed plan, as under `### A plan written during the run`
- A launchable plan joins the queue, and one with open questions parks, its questions batched to the operator in the next report

### What holds

The run launches nothing past the holds below, each a read the loop already makes.

- A row listed in `held` on `canon tasks waves --json`, whose cell says to launch on the operator's word
- A billed run the operator has not cleared, named by the plan's Testing section
- A permission classifier refusal, where the run sends no workaround and puts the exact command to the operator
- A plan question marked as needing the operator's call, or a `deferred` entry, which `plan-answers` reports
- A row whose origin leaves a call open, such as a reel width the operator has not chosen

An open release pull request holds nothing. Dispatch carries on past it, and the run neither merges it nor asks the operator to unless a merge grant covers it.

### A question from a session

Answer a technical question the way `## A question from a session` states, and batch every parked kind to the operator in the next report rather than to the morning one.

### Merging

Merge nothing without the operator's word. A grant is a standing authorization per `orchestrator-output.md`, ordered per `orchestrator-merge-order.md`, and the handoff records it with the pull requests its scope fixed.
