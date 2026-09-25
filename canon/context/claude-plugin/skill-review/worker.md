---
title: Worker
description: The rebase stage the worker's return leg carries, the worker role holding its own half of the channel, the relay serving a session holding neither role, and what the pull request announcement buys
---

# Worker

## The rebase stage

`review-address` runs a rebase stage between the doc refresh and the push, since a branch that answers every finding can still fail to merge once a sibling lands first. The orchestrator's poll reports `CONFLICT` on that transition, which is what lets the stage skip building its own detection.

The stage sits after the fixes rather than before them, so one force-push carries both and the reviewer reads a single delta. It tests with `git fetch origin main` followed by `git merge-tree --write-tree`, chosen over `gh pr view --json mergeable`, since that field returns `UNKNOWN` exactly when a poll asks.

### The no-findings path

The test runs ahead of the no-findings guard rather than inside the fix path. A guard gated on the finding count alone stops before the stage on a pull request carrying no comments, which is exactly the shape a stale branch produces when `main` moves rather than the review saying anything, so the guard decides on the rebase test instead and a run carrying no findings skips straight to it.

The reply, the terminal confirmation, and the output line each need a rebase-only form on that path, since all three otherwise assume at least one finding. The reply takes a `## Rebase` heading rather than `## Review response`, since the second claims a review the run never read and would sit under a `## Review` that does not exist. The heading also stays outside that family so the close-out's first-line equality test cannot match it.

### Two runs of the test

It also runs twice. `git merge-tree` reads committed history and the fixes are uncommitted when the stage first runs, so a branch that merges clean as committed, whose fixes touch lines `main` moved, passes the first test and reaches the remote unmergeable. The second run sits after `git-followup` commits, and it costs an extra force-push only in that narrow case.

The fixes are uncommitted by then, so the stage stashes before the rebase and pops after, and the resolution rules cover hunks from both. Both halves are conditional on a dirty tree, since a run answering every finding as a conscious-accept leaves nothing to stash and an unconditional pop would restore an unrelated entry from an earlier session. That same run has no commit for `git-followup` to carry either, which is why the push leg names a direct force-push for it.

### Conflict resolution

The rules are stated where the stage runs, which is what makes it safe. A wholesale `--ours` or `--theirs` drops one side silently and passes every check, since both sides are valid content, and a generated file merged by hand produces a diff the next regen discards. A generated file needs its own rule for that reason, and an authored file needing a count or an index updated needs judgment an orchestrator does not have, which is why the worker owns this stage rather than the orchestrator.

No comment channel exists for a conflict. Both sides of every hunk sit in the conflict itself, `main` is what the operator approved, and `git log origin/main` names what landed, so a per-conflict comment would only restate the diff and add a surface the worker waits on. A hunk the tree does not settle stops instead and reaches the operator as an ordinary finding on the next pass, which holds only because the stage forbids guessing rather than leaving it to judgment.

`git-followup` absorbs the consequence at its push, forcing under a lease when the tracking branch no longer reaches the head, since a plain `git push` is rejected on a rewritten branch. The close-out's ancestry test already covers the re-read this produces, falling back to a full pass on exactly this branch shape.

## The worker's own half

`role-worker` exists because without it the return leg the rebase stage depends on is documented only on the side that does not perform it. Worker behavior spreads across `session-worktree`, `auto-ship`, and `review-address`, each owning a step, and none of the three names the role or the channel on its own.

`auto-ship` Step 0 invokes it, in the position that already invokes `session-worktree`. That reaches a dispatched worker and a hand-launched one on one path and needs no change to the launch command, at the cost that a session doing something other than the ship chain never asserts the role.

The body stays thin by construction, since it has three readers who need different things from it. A dispatched worker reads it as its whole operating contract with nobody watching, a hand-launched one reads it beside a person who can correct it, and the orchestrator reads it to know what it may assume. A rule written for the first can be wrong for the second, so the body carries the role, the boundaries, the three obligations, the refusal right, and the lifetime, and points at the three step-owning skills for everything else.

### The channel splits by who sends

Each half is stated where its sender reads it. The worker's obligations sit in `role-worker` and the orchestrator's handback stays in `orchestrator-poll.md`. One shared section would put a worker's duties in a file no worker loads, which is the defect the split avoids. The orchestrator's step 6 points at the worker skill rather than holding its own copy.

Three messages are owed and no more. One announces the pull request when it opens, carrying the number, the branch, and the task it closes. One announces when an address-review pass finishes, carrying what was addressed and the pull request's new CI state. One reports a block before it becomes an interactive prompt.

That ordering matters: a queued message drains at the next tool round, and a session already waiting on input never reaches one, so an answer relayed to an open prompt renders beneath the question and changes nothing. Nothing is sent on progress, since a worker reporting progress rebuilds the poll on the other side of the channel.

A launch naming `review-address` alone reaches no `role-worker` and takes no role either, which risks a worker addressing a posted review and telling its controller nothing. `orchestrator-dispatch.md` carries a second launch shape reaching the role directly for that case rather than reusing the plan-build shape's chain, carrying the same `<dispatcher-id>` resolution the build shape already documents.

Refusing stays a first-class move rather than a failure mode: a worker arguing back with evidence rather than complying has reached corrections a report-upward-only body would suppress.

## The relay

`role-worker` and `role-planner` each state a channel, and each assumes a message-sending tool carries what they compose. A standalone skill for the session holding neither role never fires, because nothing routes a session to a skill matching no request and reaching for no artifact of its own.

Moving the protocol inline into each role body was the other alternative, and it trades the firing problem for a duplication one: two bodies stating one protocol is the shared-surface case `canon/ARCHITECTURE.md` already decided against, since a later fix reaching one copy and not the other diverges silently.

`session-relay` is the shape that keeps both. The firing condition survives because the pointer sits inside `## The channel`, a section both role bodies already read at session start rather than one reached by request match alone, and what remains duplicated across the two bodies is two sentences naming one skill rather than the protocol itself. A pointer drifting from its target fails loudly, since the skill it names either resolves or does not, where two copies of one protocol drift from each other in silence.

### A session holding neither role

A session holding neither role has no `## The channel` section to carry the pointer, so a relay scoped to the two roles would read neither ladder and never learn the skill existed. `canon-rollout`'s worker role is the concrete instance, structurally barred from `role-worker` since that body resolves session scratch against a main worktree root a target does not carry, and it meets the gap by naming the relay directly.

The relay serves that session directly. It refuses neither a caller holding neither role nor a caller holding a send tool, and the description fires on any relay rather than on a missing tool. What the skill holds is the mechanical half of the send: naming the sender, turning a `sessionId` or a branch into an address, and putting the text through whichever route exists. Each role keeps only who it addresses and its own last-rung inference, which a worker and a thinking session resolve differently because a worker holds a feature branch and neither of the others does.

No rule states the addressing or the timing anymore. A shipped core rule once did, for a session holding neither role, and the relay restated block-before-prompt for a target holding the plugin without governance, with `canon-rollout` restating it a third time inline. The rule sent a roleless session to check against two roles it did not hold and named the relay nowhere, so the operator retired it and made the relay the sole owner. `canon-rollout` and `role-worker` now point at the relay rather than restating it, and `role-worker`'s channel section keeps only the operator ask and its own inference rung, the shape `role-planner` already had. A project installing governance without the plugin goes without the timing line, which `canon/context/governance/routing.md` records as an exception to its cut test.

The relay's description names a session stuck on a question that owes its dispatcher a message before it stops to ask, since that is the one trigger a roleless session carries nowhere else. The routing eval is the only check that the widened description still fires, since nothing else tests what a roleless session reaches.

## What the announcement buys

The poll's condition is an open pull request alone rather than an open pull request or a dispatched worker, since the script reads pull requests and a building worker has none. The announcement covers exactly the gap that leaves open, because the transition from building to reviewable is the one moment only the worker knows.

The dispatched-worker condition survives as a fallback rather than as a trigger, applied to any dispatch still out after thirty minutes with no announcement, so a silent failure does not leave a finished worker unnoticed.

`scripts/watch.sh` covers the same window at lower cost and ships beside `poll.sh` rather than living in one session's temporary directory. It reads the open pull request list and the session roster together every sixty seconds, and coverage is the point: a worker that finishes goes idle and one that crashes vanishes, so a trigger matching only the pull request stays silent through the second. It resolves the repository from git rather than hardcoding a path, and it counts every session on a branch other than the base one as a worker rather than matching an `orchestrator-` name prefix, which reads a dispatched worker and misses every hand-launched one.

The output contract carries a third state beside `Ready to build` and `In review`, since a session holding several running workers belongs under neither. The launch section does not recommend a plan a worker is already building, since the plan file sits in place for the whole build.
