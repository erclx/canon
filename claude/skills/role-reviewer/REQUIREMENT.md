---
name: role-reviewer
description: What a dispatched reviewing session is, what it writes and reads, the acts it refuses, and the one message it owes the session that dispatched it
---

# Role reviewer requirement

## Gap

Without this skill, review is the one stage of the loop that does not fan out.
Planning goes to `role-planner` sessions and building to `role-worker` sessions,
while every first pass still runs inside the controlling session with several
pull requests held in one context. A loop is as parallel as its narrowest stage,
so a wave of planners and workers ends in a queue at review however wide the
first two stages run.

Holding many pull requests at once is also what makes the warm pass shallow. In
a blind trial on 2026-09-25, a cold session reviewing one pull request found two
real stale-count findings on a branch the controlling session had closed clean
while holding eight, because that session read the source diff closely and
skimmed the docs the branch touched. A live trial the same day dispatched three
first passes to cold sessions, and on the one pull request both sides read, the
cold pass found a finding the warm pass missed and showed one of the warm pass's
own findings wrong.

Every one of those launches restated the reviewer's bounds by hand: write the
comment alone, no worktree, no branch, no board write, no fix, no direct draft
lift.
Each is a property of the role rather than of the pull request, so each dispatch
reproduced them from memory, the shape `role-planner` was written to retire on
the planning side.

Three bounds matter more than the rest. A reviewer asked to fix what it found
has reviewed its own change afterwards, and nothing recovers the independent
read. A reviewer posting `## Review closed` is one step from readying the pull
request by hand, which skips the gates `canon pr lift` reads, and `review-pr`
Step 5 reports a merge recommendation that reads as permission when the body is
silent. A reviewer with no checkout reading a file
off the main worktree reads the trunk, so every finding it files there is about
a tree the pull request never changed.

Routing through the controlling session costs that session the most. Until
2026-10-12 each review round passed through it four times: the pass announced to
it, the dispatch to the worker, the worker's answer, and the re-review request.
Every one of those is a turn that reads the whole wave's context, and the
reviewer and the worker each already knew what the other needed next.

## Must

- Assert what a reviewing session is, what it may write, and how long the role lasts, since `review-pr` carries the pass and no body carries the role that runs it when dispatched
- Bound the writes to the comment `review-pr` posts and the body file it names, or for a UI reviewer to what `review-ui` posts and drives from, and name the tracked file, branch, worktree, board, and commit as outside them
- Send every file read a finding rests on to `git show <head>:<path>` at the head `review-pr` resolved, since the main worktree holds the trunk
- Name what the pass reads, the diff, the plan, the task's outcomes, the rules, and `review-craft`, and what it leaves, the author's argument and the worker's session, since the independence is what the trials measured
- Read the cross-branch facts a launch carries as inputs rather than findings, since the controller's wave-level read reaches this session only through the brief
- Refuse the fix, a draft lift by any route but `canon pr lift`, and the merge, whoever asks, and name who owns each, since each has a sender who will ask
- Run `canon pr lift` after posting a close, since the verb reads every gate itself and a reviewer's close is the moment the last of them can turn clear
- Send the `review-address` dispatch to the worker on an open pass, carrying the number, the heading, `review-pr` Step 5's count line, and this session's sessionId, and fall back to the controller when no worker resolves, since every hop through the controller costs it a turn that reads the whole wave's context
- Message the controller on a close with the reason `canon pr lift` returned, unless the reason names the other review as still open, since that refusal needs nothing from anyone
- Owe a message before a block becomes an interactive prompt, since a session already waiting on input never reaches the tool round an inbound message drains at
- Keep a re-review with the reviewer that took the first pass while it is live, so the second pass keeps the read the first paid for
- Defer the addressee resolution to `session-relay` and keep only the last-rung inference, which discriminates as it does for a planner because a reviewer holds no feature branch either

## Must not

- Restate `review-pr`'s steps, threshold, headings, or marker, since the controller's poll routes on them and a second copy is a second source
- Restate `review-craft`'s criteria, which apply to every reviewer alike rather than varying by role
- Restate a boundary `role-orchestrator`, `role-worker`, or `role-planner` states about itself
- Report progress through the channel, which rebuilds on the sender's side the poll the announcement exists to retire
- Post outside `review-pr` and `review-ui`, since every reader of the review headings breaks at once when one pass invents its own
- Be a skill nothing invokes but its author typing the name. `orchestrator-reviewer-launch.md` names it on the reviewer launch the way `orchestrator-launch.md` names `role-planner` on a planning one, so a stretch where only a typed invocation reaches it is the signal that the role never took.

## Guards

- Plan or task does not resolve from where the session stands: report it unreadable and name the main-root path, rather than reviewing as though the branch had no plan
- Asked by anyone to fix, ready the pull request directly, or merge: refuse, name who owns the act, and file the defect in the comment when the ask was a fix
- Launch named no controlling session and an operator is present: ask which row to address rather than inferring
- Launch named no controlling session and nobody is present: infer from the sessions holding no feature branch, report the candidates when more than one comes back, and say the addressee was inferred

## Out of scope

- The pass itself, its scoping, its body, and its post, which `review-pr` owns
- What a review looks for and how much evidence a finding needs, which `review-craft` owns
- The cross-branch pass per wave and the decision of which pull requests take a dispatched reviewer, which `role-orchestrator` holds
- Answering the review, which `review-address` owns in the worker's session
- The mechanical addressee resolution, which `session-relay` owns
