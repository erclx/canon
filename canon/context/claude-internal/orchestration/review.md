---
title: Review
description: The review trigger and its poll and watch loops, where the poll lives and keeps its baseline, and the handback dispatch that carries a posted finding to the worker
---

# Review

## The review trigger

`role-orchestrator/scripts/poll.ts` reports pull request movement so the orchestrator learns a branch moved without checking by hand, and the runbook's routing block decides what each report earns. A first pass, a re-review, and the handback dispatch all run from that block, so the operator triggers none of them. Where a pass runs is decided by `orchestrator-review-dispatch.md` rather than by the poll. A reviewer dispatched under `role-reviewer` takes the per-pull-request read, first pass included, on load or on executable content, and the warm session keeps prose-only changes and one cross-branch pass per wave over file sets. That reverses `.canon/groundwork/23-review-automation/06-decision.md`, which kept every first pass warm for the two cross-pull-request findings its sample produced. Groundwork 115 found a cold pass holding one pull request read the docs a warm pass holding eight had skimmed, and the file-set pass is what keeps the cross-branch half.

`review-pr` posts its findings as a comment on the pull request rather than returning them to the session that asked, since a finding posted there survives either session ending, and neither the orchestrator nor the worker is sure to outlive the review.

### The cloud reviewer

On the operator's pick, a dispatched code review runs on a cloud session through the cloud build's create. The posted review is its announcement, since the session cannot message the orchestrator, and `poll.ts` already lists every open pull request locally. Spike 5 posted a review in about 64 s only because the reviewer fell back to REST when the proxy refused GraphQL, so every `canon pr` read and `review-pr` lookup now runs on REST. A UI review stays local, and a re-review is a fresh dispatch, since a cloud session is absent from `canon sessions list`.

Only an open pull request starts it, since the script reads pull requests while a building worker has none, so a dispatch alone would cost a run every interval between launch and push and return nothing. The worker announces its own pull request instead, per `role-worker`, which is the one transition only that session can observe. The dispatch survives as a fallback the orchestrator applies to a worker still out after thirty minutes with no announcement, since nothing reports a silent failure of the announcement.

### The watch loop

`scripts/watch.ts` covers the same window on a loop of its own rather than on a scheduled prompt, reading the open pull request list and the session roster together every sixty seconds. The roster read is the half `poll.ts` cannot make and the reason both exist: a worker that finishes goes idle and one that crashes vanishes, so a trigger matching pull requests alone stays silent through the second. It classifies no pull request, leaving the routing block to decide what each report earns.

A worker's own status is the one thing it judges directly. A `waiting` row whose dwell crosses `STALL_THRESHOLD_S` reports as `WORKER-STOPPED` once, tracked in the same per-name state the `WORKER`/`WORKER-GONE` pair already keeps, without routing through that block. A `waiting` row whose record carries neither `statusUpdatedAt` nor `updatedAt` reports as `WORKER-UNMEASURABLE` instead, rather than folding silently into the rows the threshold clears.

Coverage behind that threshold is uneven, so read the split rather than assuming it from the mechanism. Across 352 registry records measured on 2026-08-31, 301 desktop sessions carry no status field at all, 34 of 34 background sessions launched under the CLI carry one, and 12 of 17 CLI interactive sessions do. A dispatched worker is the one population the threshold measured complete and the controller is the one where it measured zero, so `WORKER-STOPPED` reports faithfully for a wave of workers and says nothing about a desktop session or an interactive one gone quiet.

A printed line has no route to the operator on its own, since a shell loop can call no session tool and the toolkit ships no notification verb. `orchestrator-watch.md` instructs the controller to push a notification on meeting either line, at the same one-per-stall cadence `watch.ts` already tracks. The push runs inside the controller's own turn, so a controller mid-turn or itself stopped still delivers nothing.

The row goes out of `canon sessions list --json` tab-separated and back in read with `IFS` set to a tab, since a name this client writes carries spaces on its own, `Update session markdown and check runnable commands (3)` among them, and a whitespace split takes that one apart before anything reaches the threshold check.

It resolves the repository through `git worktree list` the way the poll's baseline does, rather than a hardcoded path. And it counts every session on a branch other than the base one as a worker, rather than matching a name prefix, which would read a dispatched worker and miss every hand-launched one.

### Where the poll lives

`orchestrator-poll.md` is a runbook and sits with the others, while the scripts it invokes take `scripts/` per `standards/skill.md`, which splits detail from deterministic operations. Placing both on an internal surface was the alternative, and it strands a target, which would install an orchestrator carrying its runbooks and no review trigger while the skill body names neither the poll nor the script.

Nothing catches a misplacement. The Skill paths measure in `src/gate/boundaries.ts` bans a single pattern, `wiki/`, so a skill citing a toolkit-only path passes it clean, and the placement rule holds only while a session applies the reasoning. The start and stop condition is unenforced the same way, and both halves belong to whoever holds the loop, since a session holding a recurring-prompt scheduler starts and cancels one without the operator.

The runbook cites the script as `${CLAUDE_SKILL_DIR}/scripts/poll.ts` and the loop prompt it carries cannot. That variable expands while a skill body renders, and a recurring-prompt invocation arrives as a standalone turn where it reaches the session as a literal string, so the prompt block carries a placeholder the operator substitutes. The runbook states the requirement as a recurring prompt at roughly three minutes and gives `/loop 3m` as one example, since naming a single client's command dates a file that ships to every target holding the plugin. `canon/context/claude-plugin/distribution.md` measured which variables survive.

The scripts are TypeScript, so the type check reaches them through the `claude/skills/*/scripts/**/*.ts` entry in `tsconfig.json`, and a further script costs nothing. The shell stages cover `review-ui/scripts/pw.sh` alone. `canon/context/claude-plugin/distribution.md` carries what else an executable in the plugin changes.

The script is tracked and its baseline is not. State lives at `.canon/tmp/pr/poll/baseline.txt` under the main worktree root, resolved through `git worktree list` rather than through the script's own folder, so a poll started from a linked worktree reads what one started from main wrote.

How the script classifies a pull request, its base-movement readings, and its test harness sit in `poll.md`.

## The handback dispatch

A posted finding reaches the worker as a message from the reviewing session, which is the one step in the loop where that session already knows what a specific live session should do next. `ListAgents` and `SendMessage` carry it and the source page linked from `wiki/claude/sessions.md` holds the transport, with the relay through a person as the alternative that lost.

Three findings shape the rule. Any posted finding is the gate, which is the threshold `review-pr` states and posts its open heading under, so the heading and the counts beneath it answer the dispatch question alike. A session resolves at the moment of sending and never from a stored map, because names rotate and one written down earlier in a session goes stale inside the hour. A message carries plain text, so the step names a skill for the reader to run rather than embedding an invocation that would arrive as text.

`canon sessions list --branch` performs that resolution. It answers with a count and a confidence rather than a row, so the routing reads how many sessions came back and how liveness was decided instead of addressing the first one.

Reading the target off a bare listing was the alternative and it lost on measurement. Five rows came back carrying a name, a ref, a kind, a state, and an age, four sharing one project prefix and two of those four on different branches, so a resolution that got the project right still had a one in four chance of getting the branch right. A dispatched worker is named from its task rather than from its directory, which leaves that prefix absent rather than weak.

Severity alone is a poor gate in both directions: a mis-called minor dispatches nobody and lands as a defect the operator has to notice, while a should-fix raised over a decision the plan already declined sends a worker to act on nothing. A live minors-only pass would sit until the operator ran the address skill by hand. A dispatch on any finding still sends a worker to a should-fix the plan settled, and the return leg answers that rather than a grade nobody calls consistently.

### The return leg

The return leg is the strongest argument for the channel. A worker answering a posted finding by naming the plan question that already declined it changes the outcome in the moment, where a thread comment waits on whoever reads it next.

That reply reaches the pull request rather than two transcripts that both end. The responding skill carries the fact behind a declined finding into the bullet its body already writes, and the reviewing skill states a withdrawal or a regrade with what produced it instead of dropping the finding from its next body. Keying the rule to a finding the body already enumerates is what makes it fire, since a rule asking a session to judge whether its own reply mattered is the judgment that fails in practice.

The other class stays off the thread by decision. A correction to what the reviewing session believes, such as which session holds which branch or that a worker's edits pass an approval gate, settles no finding on a pull request that closes, so it takes the route the skill already states for a change found while orchestrating and lands on the task owning that surface. Both halves are prose and no check tests a posted reply for either, so the split holds while a session applies it.

One branch ships untested. Every dispatch in the trial found a live session, so the fallback that reports the invocation for a person rests on reasoning alone.

The runbook holds the routing and the skill body points at it. Correcting a running loop is a cancel and a re-create rather than an edit, so the runbook states both directions of the divergence rather than only one.

## Gotchas

### A stamped review can carry a stale head

A review's `commit.oid` is stamped with the head at submission rather than with the commit the reviewer read, so `SEEN` can fire on a head still awaiting its first look at a real delta, when a pass written against an earlier commit lands stamped with a later head and the delta it skipped is a real fix.

A pass writes the commit it read and the instant it read it as a marker in its own body, and both `poll.ts` and `review-pr` resolve the covered state through `canon pr review-state`, so a commit pushed inside a compose window reads as `MOVED`. The same risk still holds on a record whose `source` reads `fallback`, which is a pass posted before that marker shipped or a target whose CLI predates the verb. Treat a `SEEN` under `fallback` as worth one read of `gh api repos/{owner}/{repo}/pulls/<number>/reviews` before believing it.

### A pull request's draft flag can read ready mid-undo

Marking a pull request a draft and reading the flag back are two separate calls, and nothing marks the moment between them completing. A read taken in that window sees a genuinely ready pull request about to become a draft, the opposite of what the worker reports. Read the flag itself rather than trusting a worker's own report for exactly this window.

### A peer's merge claim needs the commits

A pull request's net file diff can read as untouched for a file a peer session correctly described as changed, when an earlier commit in the same pull request added content and a later commit removed it before merge. A check reading the merged file list finds the file absent and reads the claim as false, while the individual commits show the add and the cut.

Verify a peer's claim about what a merge did against its commits, not the net diff, whenever the claim names an add-then-remove, since the net diff a session reaches for first is blind to exactly that shape.
