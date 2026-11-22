---
title: Orchestrator unattended run
description: Running the board with nobody watching, from now or from a time the operator names, which questions the orchestrator answers and which it parks, and the morning report the run ends on
---

Run this when the operator asks to leave the board running unattended, overnight or for an afternoon away. The run dispatches, plans, and reviews as an ordinary session does, and it merges nothing. The operator comes back to green pull requests and to a list of every call the run made on their behalf.

## Contents

- [Start the run](#start-the-run)
- [The loop](#the-loop)
- [A question from a session](#a-question-from-a-session)
- [Ending the run](#ending-the-run)
- [The morning report](#the-morning-report)

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

## The loop

Each pass runs the same four steps. The procedures stay in the runbooks named, so this file adds only what differs with nobody watching.

1. Run the check under `## Stop the loop` in `${CLAUDE_SKILL_DIR}/references/orchestrator-dispatch.md` against `## Up next`, launching each cleared row per `orchestrator-launch.md`.
2. Launch a planner on each `## Needs a plan` row the parallelism cap leaves room for, in the planning shape of `orchestrator-launch.md`, or the plan-and-build shape for a row that reads small.
3. Start the review poll per `${CLAUDE_SKILL_DIR}/references/orchestrator-poll.md` once a pull request opens, and the watch per `orchestrator-watch.md` beside it.
4. Answer or park each question a session sends, per the next section.

### A plan written during the run

A plan that lands mid-run builds the same night when nobody has to answer it. Run `canon tasks plan-answers <plan> --json` on the announced path and branch on `launchable` rather than the exit code.

- `launchable: true`: the row takes the dispatch checks on the next pass, like any `## Up next` row
- `launchable: false`: park every entry in `open`, per the next section, and leave the row unbuilt

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
- Every open pull request is merge-ready, parked, or stopped

A worker stays in the roster until its branch merges, and this run merges nothing. Count a worker done once its pull request passes the last test, so a night that opened one still ends.

On that pass, stop the poll and the watch, then push one notification through whatever surface the client offers, `PushNotification` in this repository's client. Name the merge-ready and parked counts, the way `orchestrator-watch.md` pushes a stall. Then write the report below.

## The morning report

The report leads with what the operator merges, since that is the one act the run left to them.

```plaintext
Unattended run: <start> to <end>

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

- Write each merge line per `## The merge line` in `orchestrator-output.md`, off `already-ready` or `clear` from `canon pr lift <number> --check --json` read at that moment
- Order the lines per `orchestrator-merge-order.md`, since two branches sharing a file still owe a rebase in that order
- List a pull request whose read refuses under `Stopped` with the reason, rather than as merge-ready

### The merge stays the operator's

Run no merge, whatever the report shows, and never call `canon pr merge`, since an operator who is away is not there to name one, and the run suspends any standing authorization. Refuse an instruction to merge during the run and list it under `Parked for you`.
