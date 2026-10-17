---
title: Review
description: The review trigger and its poll and watch loops, where the poll lives and keeps its baseline, and the handback dispatch that carries a posted finding to the worker
---

# Review

## Decisions

### The review trigger

`role-orchestrator/scripts/poll.ts` reports pull request movement, and the runbook's routing block decides what each report earns. A first pass, a re-review, and the handback dispatch all run from that block, so the operator triggers none of them.

- `orchestrator-review-dispatch.md` decides where a pass runs, not the poll
- A reviewer dispatched under `role-reviewer` takes every pull request's read but a release one's, first pass included
- The warm session reviews none in place and keeps one cross-branch pass per wave over file sets. Groundwork 115 found a cold pass on one pull request read what a warm pass on eight skimmed.

### Why not review in place

Reviewing small prose changes in place lost because every in-place pass reads a whole diff into the one context the wave shares. A cheap review on one pull request thins the attention every later one gets.

The reviewer's model comes from `## Pick the model` in `orchestrator-dispatch.md` rather than the folder a change touches, since a folder reading sent a one-bullet rule to the larger model. `review-pr` posts findings as a pull request comment, which survives either session ending.

### The cloud reviewer

On the operator's pick, a dispatched code review runs on a cloud session through the cloud build's create. The posted review is its announcement, since it cannot message the orchestrator and `poll.ts` already lists every open pull request locally.

- It posts only through REST, since the proxy refuses GraphQL, so every `canon pr` read and `review-pr` lookup runs on REST
- A UI review stays local, and a re-review is a fresh dispatch, since a cloud session is absent from `canon sessions list`
- It cannot run `canon pr lift`, whose one write is a GraphQL mutation, so the controller lifts for it

### When the trigger fires

Only an open pull request starts a review. A building worker has none, so a dispatch alone would cost a run every interval between launch and push and return nothing.

The worker announces its own pull request per `role-worker`, the one transition only that session observes. The dispatch survives as a fallback for a worker still out after thirty minutes with no announcement, since nothing reports a silent failure of the announcement.

### The watch loop

`scripts/watch.ts` covers the same window on a loop of its own, reading the open pull request list and the session roster together every sixty seconds. The roster is the half `poll.ts` cannot read. A finished worker goes idle and a crashed one vanishes, so a trigger on pull requests alone stays silent through the second.

It classifies no pull request, leaving the routing block to decide.

- It resolves the repository through `git worktree list` like the poll's baseline, not a hardcoded path
- It counts every session on a branch other than the base as a worker, since a name prefix would miss every hand-launched one
- Rows leave `canon sessions list --json` tab-separated and are read with `IFS` set to a tab, since names carry spaces, such as `Update session markdown and check runnable commands (3)`

### Worker status

A worker's own status is the one thing the loop judges directly. A `waiting` row whose dwell crosses `STALL_THRESHOLD_S` reports once as `WORKER-STOPPED`, tracked in the per-name state the `WORKER`/`WORKER-GONE` pair keeps.

A `waiting` row carrying neither `statusUpdatedAt` nor `updatedAt` reports as `WORKER-UNMEASURABLE` rather than folding into the rows the threshold clears.

### Threshold coverage is uneven

Across 352 registry records measured on 2026-08-31, coverage split by population.

| Population                        | Carry a status field |
| --------------------------------- | -------------------- |
| Desktop sessions                  | 0 of 301             |
| Background sessions under the CLI | 34 of 34             |
| CLI interactive sessions          | 12 of 17             |

`WORKER-STOPPED` reports faithfully for a wave of workers and says nothing about a desktop or interactive session gone quiet.

### Notifying the operator

A printed line has no route to the operator, since a shell loop can call no session tool and the toolkit ships no notification verb. `orchestrator-watch.md` instructs the controller to push a notification on either line, at the one-per-stall cadence `watch.ts` tracks.

The push runs inside the controller's own turn, so a controller mid-turn or itself stopped delivers nothing.

### Where the poll lives

`orchestrator-poll.md` is a runbook and sits with the others. The scripts it invokes take `scripts/` per `claude/skills/create-skill/references/skill.md`, which splits detail from deterministic operations.

Placing both on an internal surface strands a target, which would install an orchestrator with its runbooks and no review trigger while the skill body names neither.

- Nothing catches a misplacement. The Skill paths measure in `src/gate/boundaries.ts` bans one pattern, `wiki/`, so a skill citing a toolkit-only path passes clean.
- The start and stop condition is unenforced the same way. Both halves belong to whoever holds the loop, since a session with a recurring-prompt scheduler starts and cancels one without the operator.

### The loop prompt

The runbook cites the script as `${CLAUDE_SKILL_DIR}/scripts/poll.ts` and the loop prompt it carries cannot. That variable expands while a skill body renders, and a recurring prompt arrives as a standalone turn where it stays a literal string, so the prompt block carries a placeholder the operator substitutes.

- The runbook states a recurring prompt at roughly three minutes and gives `/loop 3m` as one example, since one client's command dates a file shipping to every target
- `canon/context/claude-plugin/distribution.md` measured which variables survive, and carries what else an executable in the plugin changes
- The scripts are TypeScript, reached by the type check through the `claude/skills/*/scripts/**/*.ts` entry in `tsconfig.json`. The shell stages cover `review-ui/scripts/pw.sh` alone.

### The baseline

The script is tracked and its baseline is not. State lives at `.canon/tmp/pr/poll/baseline.txt` under the main worktree root, resolved through `git worktree list` rather than the script's folder, so a poll from a linked worktree reads what one from main wrote.

How the script classifies a pull request, its base-movement readings, and its test harness sit in `poll.md`.

### The handback dispatch

A posted finding reaches the worker as a message from the reviewer that posted it, the one session that knows what the worker should do next. The worker sends its re-review request straight back, addressed by the sessionId the dispatch carried.

- A reviewer holds the trunk branch, so `canon sessions list --branch` finds none
- `ListAgents` and `SendMessage` carry both, and the source page linked from `wiki/claude/sessions.md` holds the transport
- A relay through a person was the alternative that lost

### Why the controller is off the path

Relaying every leg through the controller also lost. A round cost it four turns, each reading the whole wave's context, to forward what the reviewer and worker already held.

- The controller now hears a close, a refusal other than the other review still being open, and a block, so a clean round costs one inbound turn
- Copying it on every direct message was declined, since that keeps its inbound count at the old two per round
- It stays the fallback sender for a cloud reviewer, which can send no message, and for either side reporting the other unreachable
- The poll's after-finding rule fires only for a pass no live reviewer sent on, so a worker never gets two dispatches for one pass

### Three findings shape the rule

The rule rests on three findings about what a dispatch can rely on.

- Any posted finding is the gate. It is the threshold `review-pr` states and posts its open heading under, so the heading and its counts answer the dispatch question alike.
- A session resolves at the moment of sending, never from a stored map, because names rotate and one written down earlier goes stale inside the hour
- A message carries plain text, so the step names a skill for the reader to run rather than embedding an invocation that would arrive as text

### Resolving the target

`canon sessions list --branch` performs the resolution. It answers with a count and a confidence rather than a row, so the routing reads how many sessions came back and how liveness was decided instead of addressing the first one.

Reading the target off a bare listing lost on measurement. Five rows came back, four sharing one project prefix and two of those on different branches, so getting the project right left a one in four chance on the branch. A dispatched worker is named from its task, which leaves that prefix absent rather than weak.

### Why not gate on severity

Severity alone is a poor gate in both directions. A mis-called minor dispatches nobody and lands as a defect the operator must notice, and a should-fix over a decision the plan already declined sends a worker to act on nothing.

A live minors-only pass would sit until the operator ran the address skill by hand. A dispatch on any finding still reaches a settled should-fix, and the return leg answers that rather than a grade nobody calls consistently.

### The return leg

The return leg is the strongest argument for the channel. A worker answering a finding by naming the plan question that declined it changes the outcome in the moment, where a thread comment waits on whoever reads it next.

- The reply reaches the pull request rather than two transcripts that both end
- The responding skill carries the fact behind a declined finding into the bullet its body already writes, and the reviewing skill states a withdrawal or regrade with what produced it
- Keying the rule to a finding the body already enumerates is what makes it fire, since a rule asking a session to judge whether its reply mattered fails in practice

### What stays off the thread

A correction to what the reviewing session believes settles no finding on a pull request that closes. Which session holds which branch, or that a worker's edits pass an approval gate, are examples.

It takes the route the skill states for a change found while orchestrating, and lands on the task owning that surface. Both halves are prose and no check tests a reply for either, so the split holds while a session applies it.

### Untested and runbook ownership

One branch ships untested. Every dispatch in the trial found a live session, so the zero-session fallback rests on reasoning alone. It launches the review-address shape and reports the invocation for a person only when that launch cannot run.

The runbook holds the routing and the skill body points at it. Correcting a running loop is a cancel and a re-create rather than an edit, so the runbook states both directions of the divergence.

## Gotchas

### A stamped review can carry a stale head

A review's `commit.oid` is stamped with the head at submission, not the commit the reviewer read. `SEEN` can fire on a head still awaiting its first look at a real delta, when a pass written against an earlier commit lands stamped with a later head.

- A pass writes the commit it read and the instant it read it as a marker in its own body
- `poll.ts` and `review-pr` resolve the covered state through `canon pr review-state`, so a commit pushed inside a compose window reads as `MOVED`
- A record whose `source` reads `fallback` still carries the risk, being a pass posted before the marker shipped or a CLI predating the verb
- Read `gh api repos/{owner}/{repo}/pulls/<number>/reviews` once before believing a `SEEN` there

### A pull request's draft flag can read ready mid-undo

Marking a pull request a draft and reading the flag back are two calls, and nothing marks the moment between them completing. A read in that window sees a genuinely ready pull request about to become a draft, the opposite of what the worker reports. Read the flag itself rather than trusting a worker's report.

### A peer's merge claim needs the commits

A pull request's net file diff can read as untouched for a file a peer correctly described as changed. An earlier commit added content and a later one removed it before merge, so a check on the merged file list finds the file absent and reads the claim as false.

Verify a peer's claim about what a merge did against its commits, not the net diff, whenever the claim names an add-then-remove.
