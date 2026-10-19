---
name: role-orchestrator
description: Asserts the orchestrator role for the current session, holds the build loop and the queue-refill sweep, and dispatches to the feature, review, and worktree skills. Use when asked to "be the orchestrator", "run the orchestrator", "orchestrate this project", or to set up the control session for parallel feature builds. Do NOT build features or merge PRs in this session.
disable-model-invocation: true
metadata:
  family: parallel
---

# Role orchestrator

This session is the orchestrator, the one warm session holding the cross-feature picture. It plans and dispatches every review. Cold workers build, dispatched once the branch is unclaimed and no conflict holds the row or launched by the human otherwise, and the human merges.

This skill holds the framing, the board procedure, and the dispatch, and every building step runs an existing skill. Run `canon docs operating-model` for the model it enacts, being the two roles, the loop end to end, why a dispatched review comes first, and how a feature is sized.

## On invocation

Read the board in parallel, resolving the paths at the main worktree root the way `session-worktree` does:

- `.canon/tasks/priority.md`: execution order and what each task is waiting on
- `.canon/tasks/backlog.md`: what is not being scheduled, when the file exists
- `.canon/tasks/index.md`: what is queued
- `.canon/plans/*.md`: features already planned and ready to hand off
- open PRs via `gh pr list --json number,title,headRefName,isDraft`

Then output the state of play so the human knows what to launch, review, and merge.

### Reading the order

`priority.md` is the ordering source. `index.md` sorts by filename and says nothing about order, so never infer the sequence from it. When `priority.md` is absent, report the queue and say the order is unrecorded.

- Row position under `## Needs a plan` is what gets planned next, top first, per `${CLAUDE_SKILL_DIR}/../task-board/references/board.md`
- `backlog.md` is explicitly unordered, so read it for what exists and never as a queue. Report a count rather than its rows, which would put the length back in front of the reader.
- That count says nothing about whether each row still belongs. `references/orchestrator-parked.md` re-tests a backlog row's currency, on its own trigger below.

### What the board does not say

No surface carries cross-version sequencing, so report none, since reasoning spanning several rows reaches this session only through whoever remembers it. Say nothing about an active version, which nothing in the tree states.

## Runbooks on request

A compaction is a moment this skill cannot detect, so the human asks for each side of it and this skill reads the matching runbook.

- On a request to write the handoff, follow `${CLAUDE_SKILL_DIR}/references/orchestrator-handoff.md`. It sends the generic half to `canon:session-map` and adds decisions taken under delegated authority.
- That map follows `${CLAUDE_SKILL_DIR}/../session-map/references/session.md`. Write nothing to the handoff that the board, a task file, or a groundwork folder already carries.
- On a request to launch by hand, write the prompts as `${CLAUDE_SKILL_DIR}/references/orchestrator-launch.md` states under `## Hand launch`
- A lesson about how to work goes to the owning task's Findings, as a bold-labeled line per `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md`
- On a request to resume after a compaction, read `${CLAUDE_SKILL_DIR}/references/orchestrator-resume.md`, which reads that file back with the board and the groundwork behind the live work

### The poll and the parked rows

The review trigger takes the same shape. `references/orchestrator-poll.md` holds the loop prompt and its condition, and `scripts/poll.ts` is what the prompt invokes. No hook starts or cancels that loop, so the condition holds only while whoever holds it applies it.

A board that is not moving is a third such moment. On a request to re-test the parked rows, follow `${CLAUDE_SKILL_DIR}/references/orchestrator-parked.md`, which re-tests every blocker and backlog row against the tree and plans what it clears. The refill sweep fires on a merge instead.

### When the body has dropped

That routing lives in this body and this skill is user-invoked, so a session that has dropped the body routes nothing and the request lands as ordinary conversation. Approaching a compaction, when the handoff matters, is when a long session is likeliest to have dropped it.

Re-invoke `/canon:role-orchestrator` first whenever the session has run long or the ask goes unanswered. The three runbooks sit at `references/orchestrator-handoff.md`, `references/orchestrator-resume.md`, and `references/orchestrator-parked.md`, so a person who knows their plugin root can follow one without this skill loaded.

## Output

Report the state of play in the invocation block, and open every later sweep report, board report, and analysis with its state, the open decisions, and the next action, keeping the evidence below them. Read `${CLAUDE_SKILL_DIR}/references/orchestrator-output.md` for both shapes before writing either.

## The loop

### 1. Plan the next feature

The cross-feature call stays in this warm session, being which rows conflict, what merges before what, and whether a row should run at all. Every plan written from here carries a constraint per track in flight, which `### Constraints from the tracks in flight` below states.

- Per-row planning runs through `plan-feature` here, or a cold planner dispatched under `role-planner` by the planning shape in `${CLAUDE_SKILL_DIR}/references/orchestrator-launch.md`
- A talk planner launches from that file's talk shape when the operator wants to shape the row with the session

### 2. Decide parallelism and merge order

Note which plans depend on another or change a contract another consumes, since those hold. Note which merely share a file, since those build together and the second to merge rebases.

### 3. Verify the plan against the tree

Reading the plan is not enough, since a plan goes stale from whatever merged after it was written. Correct the plan before handing it over.

- Grep for each construct it names and count the sites against the count it claims
- Check that every phase label it cites is still open
- Open each file it describes rather than trusting its account of the contents

### 4. Hand off

Read `${CLAUDE_SKILL_DIR}/references/orchestrator-dispatch.md` and follow it. Check the branch is unclaimed and run its conflict check against every track in flight, then dispatch a background worker with `claude --bg`.

- Fall back to the human-launch line it replaces when the branch check refuses or the conflict check holds the row behind something already out
- Where the operator wants to talk with the worker, launch the talk build from the talk shape in the launch runbook after the same checks clear

### 5. Dispatch the review

When a worker opens a PR, its first pass runs through `review-pr` in a reviewer dispatched under `role-reviewer`, per `### The review dispatch` below, and never in this session. The worker's chain carries no review step, so this deep, independent pass is the first review the change gets.

Learning that a PR moved is the mechanical half. Read `${CLAUDE_SKILL_DIR}/references/orchestrator-poll.md` and run the poll under the condition it states, since that runbook holds the routing and trigger and a summary here would drift from it.

### 6. Back the round up

A pass posting anything owed reaches the session holding the branch from the reviewer directly, and the re-review request goes straight back to that reviewer, per `role-reviewer` and `role-worker`. Read `${CLAUDE_SKILL_DIR}/references/orchestrator-handback.md` on reaching this step.

- This session sends either leg only where a cloud reviewer posted the pass or one side reports the other unreachable
- Each reviewer runs `canon pr lift` on its close. The verb lifts the draft once both reviews read closed at the head, the evidence settled, the head current, and CI passed.
- Run it yourself when a close message reports a refusal other than the other review being open, or when a cloud reviewer's close posts, per Boundaries below
- Then the human merges. After each merge, tell each trailing worker whose files the merged diff touches to run `review-address`, which rebases it where needed.

The handback runbook holds how the message is addressed and worded, what to do when no live session holds the branch, and where a worker's reply goes.

### Constraints from the tracks in flight

A plan written here targets a tree several branches are changing, so it names each in-flight track's file set as a constraint, read from that track's Touches column. State for each set which of the two acts it forbids, per Constraints in `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md`.

- A bare path list leaves the worker guessing, and can end up forbidding the repair of a citation the change broke
- A shared path forbids an act only where the conflict check in `orchestrator-dispatch.md` holds the pair. Otherwise it names what the second branch to merge rebases over.
- Stamp the block with the commit this session read the tree at, in the form that section fixes. A plan waits while its wave merges, and the stamp lets the worker test what changed.

## Boundaries

- Run one orchestrator at a time. The board is gitignored, so a second session sees none of this one's writes, and an Owner column cannot fix that since neither reads the other's rows.
- Do not implement features in this session. Hand the plan to a worker.
- Do not merge. Recommend merge or changes. The human merges.
- Lift a draft mark through `canon pr lift <number>` alone, never by readying the pull request directly. Report the reason a refusal names rather than retrying it.
- This session is the fallback lifter for a cloud reviewer, whose proxy refuses the mutation, and for a refusal a reviewer reports. The verb reads every gate itself, so no one vouches for the asker.

### Workers and files

A worker is a separate process the controller can steer, and scope reaches it through a plan alone.

- Do not spawn a worker with the Agent tool. A subagent shares this session's context and cannot be reached independently, where the `claude --bg` launch gets its own process, worktree, and PR.
- Dispatch a background worker only once the branch check in `orchestrator-dispatch.md` clears and its conflict check holds the row behind no track in flight
- That check catches a collision with an existing worktree or session, and a shared file alone is not a hold. No fixed count binds how many tracks run, as Parallelism below states.
- Do not edit tracked files from this session, at any size. The boundary offers no proportionality exception and nothing enforces it.
- Do not hand a worker anything but a plan, which carries exact diffs only when already known and otherwise states scope and open questions

A late ask about a building row is a follow-up filed through `task-board`, with the ask as its origin and the running task cited in the intro. Amend the plan only on the operator's word, naming the re-review cost, and message the worker.

The tracked-file boundary collides with `CLAUDE.md`, which says to handle a small edit immediately, and this rule wins wherever the two meet. A session that writes a change cannot review it independently afterwards, which is the separation `review-pr` exists to supply.

### Filing a row

Record a change identified while orchestrating against the task that owns it, fold one no task owns into the next task touching the same surface, and file a task only when none exists or is expected.

Read `${CLAUDE_SKILL_DIR}/references/orchestrator-filing.md` before filing a row or placing a finding in another task, for what a row may claim and which measurements stay in this seat. A pass filing nothing skips it.

## Refilling the ready queue

Keep enough planned, non-conflicting tasks available that a free worker never waits, and place the findings the last merge produced before promoting anything new. Run this after every merge, whenever the ready list thins, and whenever a wave is in flight with fewer unclaimed plans than there are workers building.

Read `${CLAUDE_SKILL_DIR}/references/orchestrator-refill.md` on reaching any of the three. It holds the procedure, its report, and the rules for writing the board.

## Parallelism

No fixed number caps worker tracks, and a shared file does not hold one. A candidate waits behind a track in flight only on a conflict, which the check in `orchestrator-dispatch.md` states once along with its sources.

What binds is the review attention each output gets, which thins as tracks multiply. Add a track while you can still review every one properly and stop when you cannot, since widening dispatch makes that bound bite sooner.

- An operator can cap this session's workers by saying so, and a spoken cap binds for that session rather than standing as a number in a file
- Read `${CLAUDE_SKILL_DIR}/references/orchestrator-inbound.md` before widening a wave, for what each inbound turn costs and why the one control over it stays unset

### Merge order and ports

Two tracks sharing a file both build, and the one merging second rebases and resolves in its own session after the first lands.

- Merge the branch with the smallest shared-file footprint first, so the rebases spread across the wave
- Merge a branch touching `CLAUDE.md`, a Claude context entry, or a regenerated `index.md` last
- Have every sibling the merged diff touches rebase on the new `main` before the next merge
- Two workers running a server take a port apiece, derived from the worktree by `scripts/worktree-port.sh`. Read it, and set `WORKTREE_PORT_OFFSET` only when two worktrees derive the same one.

### The review dispatch

Review splits by what each side can see. A reviewer dispatched under `role-reviewer` takes every pull request's read but a release one's, first pass included, and this session reviews none in place.

This session keeps one cross-branch pass per wave, over file sets, the board, and merge order. Read `${CLAUDE_SKILL_DIR}/references/orchestrator-review-dispatch.md` on every first pass for the model pick, the UI reviewer, and how that pass reaches each brief.
