---
title: Operating model
description: Orchestrator, planner, and worker roles for building across parallel sessions
category: Workflow
---

# Operating model

A way to build fast and reliably across parallel Claude Code sessions without a
loop and without losing the human review gate. One warm session holds the
cross-feature call and reviews. Planning runs there or in a session of its own.
Cold worker sessions build. The human launches workers and merges.

This page covers the roles and the loop. For the worktree mechanism (isolation, merge
order, port collisions), see [Claude Code and git worktrees](../../wiki/claude/worktrees.md).

## Four roles

The split is by vantage, not by capability. All four are Claude Code sessions.

| Role         | Session                               | Owns                                                    | Does not                          |
| ------------ | ------------------------------------- | ------------------------------------------------------- | --------------------------------- |
| Orchestrator | One warm, long-lived session          | The cross-feature call, deep PR review, merge order     | Edit tracked files, merge PRs     |
| Reviewer     | One cold session per pull request     | The per-pull-request read, posted through `review-pr`   | Fix findings, lift a draft, merge |
| Planner      | One session per row, warm or cold     | Measure the row against the tree, write one plan        | Enter a worktree, write the board |
| Worker       | One cold worktree session per feature | Implement, self-check, open PR, answer the orchestrator | Write the shared board, merge     |

Each role is asserted explicitly rather than inferred. The orchestrator loads
`role-orchestrator` at the start of its session, a worker loads `role-worker`,
which `auto-ship` invokes at Step 0 so a dispatched build and a
hand-launched one reach it on the same path, and a planner loads
`role-planner` and a reviewer `role-reviewer` from the launch that dispatches
it. All four are framing and boundaries rather than logic.

The planner is the one role the orchestrator also performs. Per-row planning
runs warm inside the orchestrator's own session or cold in a dispatched one, and
the boundary between them is the cross-feature call: which rows collide, what
merges before what, and whether a row should run at all stay with the
orchestrator, because a session reading the board sees blockers and file sets
and can write a confident merge order off a partial picture. The per-row
measurement is free to go cold, since a cold planner reads the tree rather than
trusting what the task file claims.

A dispatched planner owes two messages: the plan's path as the file lands, with
what the task file got wrong beside it, and a block before that block becomes an
interactive prompt. The plan file is its only write. A stale count, a moved line,
or a path that no longer resolves is reported rather than repaired, since the
task file and the board stay the orchestrator's to write.

A worker that halts on a plan question it may not answer, or argues back against
an instruction the tree contradicts, is working correctly. It never writes
`.canon/tasks/priority.md` or the backlog beside it, and reports the row it
needs for the orchestrator to write. `role-worker` carries the reason for each.

The orchestrator's cell reads every tracked file rather than every feature, and
it offers no exception for a small one. A correction found while orchestrating
goes to the task that owns the surface, or folds into the next task touching it,
because a session that writes a change cannot review it independently afterwards
and no later session recovers that vantage.

Filing that row stops at the defect and the surface it was seen on. How far the
defect reaches and what causes it belong to whoever plans the row, so it arrives
carrying neither a count nor an asserted mechanism, and the seat that found it
says as much in a plain sentence rather than supplying either. What separates the
two is what a measurement decides: the blocker re-test, the collision check, and
the file set compared against every track in flight all decide whether a row can
start, and only a count of the defect's extent decides how big it is.

## The loop

One feature travels this path end to end.

1. The next feature is planned with `plan-feature`, writing a plan to `.canon/plans/`. The orchestrator runs it warm when the row turns on a contract other features consume or a shared wiring seam, and dispatches a planner under `role-planner` otherwise. A cold planner measures the row against the tree rather than trusting what the row claims, and it reads what is in flight by composing the live session roster with open pull requests. A bare branch or worktree is not evidence on its own, since this repository leaves both behind after a squash merge.
2. Orchestrator checks the plan waits on nobody, checks the branch is unclaimed, and checks the plan's file set is disjoint from every track in flight, then dispatches a background worker with `claude --bg` against the plan, naming the branch and the model on the launch rather than leaving the worker to derive either. No count caps how many run at once. The branch travels as the argument to the worker's own worktree call, which is the one place the name is read rather than inferred. It falls back to naming the invocation for a human to run through `session-worktree` and `auto-ship` when the plan still waits on an answer only the operator can give, the check refuses, the sets overlap, or a stated reason serializes the plan behind a track already in flight. Either way, the worker enters its own worktree, builds, self-checks, opens a PR, and stops at the PR boundary.
3. A reviewer dispatched under `role-reviewer`, or the orchestrator in place, reviews the PR with `review-pr` and posts findings to it.
4. Orchestrator tells the session holding that branch to run `review-address` once the pass posted a finding at any severity, resolving the target then with `canon sessions list --branch` and reporting the invocation for the human when no live session holds it. The worker addresses the findings, rebases onto `origin/main` when a sibling landed first and left the branch unable to merge, then pushes a follow-up. A pass carrying only minor findings dispatches too, since the grade runs low often enough that a floor at should-fix loses fixes a worker would have made. `review-pr` states that threshold and the heading follows it, so an open heading is itself the signal to send.
5. Orchestrator closes the review out with `review-pr` again. The second pass reads only the commits the follow-up added, or the worker's response alone when the follow-up added none, and posts under `## Review` when it finds anything and under `## Review closed` when it finds nothing, so a reader learns from the heading whether work is still owed and takes the merge decision from the counts on the line under it. A pass finding nothing where a close-out already stands rewrites that comment to cover what it read rather than posting a second one, so the thread carries one live verdict. Repeat from step 4 until a pass closes the review.
6. The human reads the result and merges. The orchestrator tells any trailing worker whose branch shares a seam with the merged one to run `review-address`, which rebases whether or not the review left anything open.

There is no loop construct here. Each worker is a single build that halts at the
PR. The merge stays a manual human gate. Reliability comes from the plan being
complete enough that the cold session does not come back with questions, and
from merging promptly so the next PR does not rot against a moving main.

## Two review layers

The worker's self-review and the orchestrator's review are not the same pass run
twice. They differ by vantage.

- Worker self-review, inside `auto-ship`: the session that wrote the code. Its job is "did I build the plan and does it pass?" Mechanical, and structurally blind to its own misreadings, because the same misreading wrote both the code and the review. This is the green gate that decides whether the PR opens.
- Orchestrator review, via `review-pr`: a fresh session with cross-feature context (the board, a sibling PR in flight, a downstream contract). Its job is "is this right and does it fit?" It can question the plan itself. This is the merge gate.

They collide only if the worker also runs a deep pass. Keep the worker's review
light and let the orchestrator own the deep, independent one. The human read at
merge is the final gate. No layer repeats another.

The orchestrator's pass also reads the pull request body against itself, which is
a vantage the worker never has. This repository squash-merges, so the body
becomes the commit message and the record on the trunk once the branch is gone.
`canon pr key-changes` compares the paths the body's Key Changes claims against
its own changed-file list, and a claim the diff does not carry is a finding on
the body rather than on a file. See
[Key Changes bijection](../agents/key-changes.md).

## The review channel

Findings travel on the PR. `review-pr` posts them there.
`review-address` reads them back, fixes each, replies or resolves the
threads, and pushes a follow-up. `review-pr` then runs again, reading only
what the follow-up added.

Both halves of that loop key on a commit rather than on the pull request object,
which trails the branch ref by up to a minute after a push and says nothing
about the trail. `canon pr head` resolves the tip the review pass scopes its
delta against, and `canon pr checks` reports the runs belonging to that tip, so a
follow-up push cannot be read as green off the predecessor's completed run. See
[Head-sensitive pull request reads](../agents/pr-reads.md).

Three messages travel from the worker to its controller, and `role-worker`
states each with its reason: the worker's pull request as it opens, the end of
each address-review pass with the new CI state, and a block before it becomes an
interactive prompt. Nothing is sent on progress. An open pull request is what
starts the controller's review poll, with a dispatch still silent after thirty
minutes kept as a fallback.

What the session channel carries is the handback instruction and the worker's
reply to it, which is a notification layer over a record that stays on the PR. A
reply that changes an outcome, such as a worker naming the plan question that
already declined a finding, still belongs back on the PR, since the session
holding it ends and the thread is what a later reader opens.

Two rules put it there rather than leaving that to whoever remembers. A finding
the worker declines carries the fact that settled it in the same reply body that
already maps every finding, and a pass accepting that argument states the
withdrawal or the regrade with what produced it instead of dropping the finding
from its next comment.

A reply that corrects the reviewing session rather than a finding stays off the
thread. Which session holds which branch, or what gate a worker's edits pass
through, changes no finding on a pull request that closes, so it goes to the task
owning that surface. Nothing checks either rule, so both hold while a session
applies them.

A finding answered without a commit leaves the head where the first pass read it,
which a gitignored record and a finding accepted as recorded both produce. The
close-out is still owed there, since the newest heading is what tells an operator
whether the branch is blocked, so the pass reads the worker's response rather than
a delta and names its body from that response instead of from a tree that did not
change.

A branch that stopped merging while the review was open is the worker's problem
to close. `review-address` rebases onto `origin/main` between the fixes
and the push, so one force-push carries both and the reviewer reads one delta.
The staleness test sits ahead of the no-findings guard, so a branch whose review
closed clean and then went stale still rebases when the skill is invoked. The
re-read costs a full pass rather than a delta, since the prior reviewed commit no
longer reaches the head, and `review-pr` detects that itself.

The heading carries the state rather than the pass number. A pass carrying
anything owed takes `## Review` and a pass carrying nothing takes
`## Review closed`, so a thread can be scanned for what still owes work without
opening a comment. One threshold governs the heading and the dispatch alike, and
`review-pr` is where it is stated, so every other surface cites that skill
rather than restating the grades.

The merge decision comes off the counts on the summary line, since an open
heading now covers a minor as well as a critical. One thing the pass posts sits
outside those counts and inside the threshold anyway. It reads the description's
Testing section against what the repository can drive, and asks about a box left
unchecked for a person where a harness already covers the run. The question
takes no severity, because whether a human is required is a judgment the author
may hold a reason for, and it still opens the heading and sends the dispatch,
because the author is the only party who can answer it.

A minor the worker declines goes to the findings of the task the
branch closes, since a thread does not survive the merge. Feedback kept on the
PR outlives both sessions, so no human copies review between them.

## Feature sizing

The unit is fixed by the ceremony: one feature is one plan, one worktree, one
PR, one review sitting. Split a feature down when a backend contract and its
consumer both change, landing the contract first so no UI is built on a shaky
contract. Merge a change up into an ordinary edit when it is a few lines with no
new contract, skipping the plan and worktree entirely. The smell test: if the
whole change does not fit in your head at review time it was too big, and if the
coordination costs more than the change it was too small.

## Where work comes from

Two tiers hold work at different altitudes.

- Tasks (`.canon/tasks/`): the active few pulled into the current turn, one file each. Gitignored, high churn. Shape governed by `standards/tasks.md`. `priority.md` beside them carries execution order, and `backlog.md` carries what nobody is scheduling, both shaped by `standards/board.md`.
- Edits: a few lines, done immediately with no ceremony.

Nothing above these sequences work into versions. Scope is stated in
`canon/REQUIREMENTS.md` and reaches the board as discrete tasks, so why one
task runs before its neighbors is on its row and why one group of work runs
before another is carried nowhere at all.

## Parallelism

The binding constraint is the human and the shared files rather than the board.
No number caps worker tracks. Open one whenever its file set is disjoint from
every track already in flight, compared at the file path rather than at a folder
above it, and stop adding once you can no longer review every output properly.
Serialize a track sharing a wiring seam with another, and serialize one whose
sets are disjoint when a stated reason still puts it behind another.

Review splits by vantage. A reviewer under `role-reviewer` takes a pull
request's read, first pass included, when three await one (a number set by
hand), when a diff is too large to hold, or when it changes code or a skill or
rule body. Prose stays with the orchestrator, which keeps one cross-branch pass
per wave over file sets, the board, and merge order.

Inbound turns cost the controlling session as well, so weigh the spend before
widening. A message from one of your other sessions arrives as a new turn
carrying the whole accumulated context, and a recurring poll bills that window
again on its own interval, which means a wide wave spends against the
orchestrator rather than against any worker. `crossSessionInbound` is the one
control over that and stays unset here, since `hold` and `refuse` both break the
worker handback and `accept` bounds nothing.

Unit checks run freely in many worktrees at once.
A dev server, an end-to-end run, and a screenshot run alongside each other on a
web stack, since every worktree derives its own port. Singleton resources (one
local model server, one GPU) still serialize, as does any port a stack fixes by
hand. See
[Claude Code and git worktrees](../../wiki/claude/worktrees.md) for merge order and the
port-collision detail.

## Related

- [Claude Code and git worktrees](../../wiki/claude/worktrees.md) for the isolation and fan-out mechanics
- [Claude Code subagents](../../wiki/claude/subagents.md) for in-session parallelism without worktrees
- `canon/context/claude-plugin/skill-strategy/overview.md` for how the skills in the loop are categorized
