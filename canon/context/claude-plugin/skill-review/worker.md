---
title: Worker
description: The worker's rebase stage and half of the channel, the relay for a roleless session, what the announcement buys, and why the return leg runs on REST
---

# Worker

## Decisions

### The rebase stage

`review-address` runs a rebase stage between the doc refresh and the push, since a branch that answers every finding can still fail to merge once a sibling lands first. The orchestrator's poll reports `CONFLICT` on that transition, so the stage needs no detection of its own.

- The stage sits after the fixes, so one force-push carries both and the reviewer reads a single delta
- It tests with `git fetch origin main` then `git merge-tree --write-tree`, chosen over `gh pr view --json mergeable`, which returns `UNKNOWN` exactly when a poll asks

### The no-findings path

The test runs ahead of the no-findings guard. A guard gated on the finding count stops before the stage on a pull request with no comments, the shape a stale branch has when `main` moves and the review says nothing. The guard decides on the rebase test instead, so a run with no findings skips straight to it.

- The reply, the terminal confirmation, and the output line each need a rebase-only form, since all three assume at least one finding
- The reply takes a `## Rebase` heading, because `## Review response` claims a review the run never read
- That heading stays outside the response family so the close-out's first-line equality test cannot match it

### Two runs of the test

The test runs twice. `git merge-tree` reads committed history and the fixes are uncommitted at the first run, so a branch that merges clean as committed, whose fixes touch lines `main` moved, reaches the remote unmergeable.

- The second run sits after `git-followup` commits and costs an extra force-push only in that narrow case
- The stage stashes before the rebase and pops after, and the resolution rules cover hunks from both
- Both halves are conditional on a dirty tree, because a run with nothing to stash would otherwise pop an unrelated entry from another session
- A run answering every finding as a conscious-accept has no commit for `git-followup` to carry, so the push leg names a direct force-push

### Conflict resolution

The rules are stated where the stage runs, which makes it safe. A wholesale `--ours` or `--theirs` drops one side silently and passes every check, since both sides are valid content. A generated file merged by hand yields a diff the next regen discards, so it has its own rule.

An authored file needing a count or an index updated needs judgment an orchestrator lacks, so the worker owns this stage.

- No comment channel exists for a conflict, since both sides sit in the hunk and `git log origin/main` names what landed, so a comment would restate the diff
- A hunk the tree does not settle stops and reaches the operator as an ordinary finding on the next pass, which holds only because the stage forbids guessing
- `git-followup` forces under a lease when the tracking branch no longer reaches the head, since a plain push is rejected on a rewritten branch
- The close-out's ancestry test already falls back to a full pass on this branch shape

### The return leg runs on REST

A cloud worker answering a review runs `review-address`, which calls `git-followup`, and the cloud's GitHub proxy refuses GraphQL. Every `gh pr` subcommand runs on GraphQL, so both bodies resolve the pull request through `canon pr head --json` and read, post, and edit through `gh api` alone.

An early cloud run posted its reply only because the worker reached for REST unprompted, and the contract turns that improvisation into the path.

- Writes moved with reads, since `gh pr comment` and `gh pr edit` fail there as surely as a read
- Step 6 keeps the `id` the issue-comments POST answers with, which Step 7's edit takes, so no id is cut out of a URL
- The fallback lookup for a CLI predating `canon pr head` encodes the branch into the pulls query and refuses on two open pull requests, matching the verb's `ambiguous-pull`

### What REST covers

`review-ui` posts its verdict and `git-split` opens and retargets its pull requests through REST as well, since a cloud session runs both. `src/claude/skills-rest.test.ts` fails on any `gh pr` subcommand in all five paths it covers.

The leg also reaches `git-pr/references/evidence.md`, because `git-followup` mints a preview through it. That one file sits in the list while the rest of `git-pr` does not.

### The worker's own half

`role-worker` exists because the return leg the rebase stage depends on was documented only on the side that does not perform it. Worker behavior spreads across `session-worktree`, `auto-ship`, and `review-address`, none of which names the role or the channel.

`auto-ship` Step 0 invokes it, where it already invokes `session-worktree`. That reaches a dispatched and a hand-launched worker on one path with no launch command change, at the cost that a session doing something other than the ship chain never asserts the role.

### Why the body stays thin

The body has three readers. A dispatched worker reads it as its whole contract with nobody watching, a hand-launched one reads it beside a person who can correct it, and the orchestrator reads it to know what it may assume. A rule written for the first can be wrong for the second.

So it carries the role, the boundaries, the three obligations, the refusal right, and the lifetime, and points at the three step-owning skills for the rest.

### The channel splits by who sends

Each half is stated where its sender reads it. The worker's obligations sit in `role-worker` and the orchestrator's handback stays in `orchestrator-poll.md`, since one shared section would put a worker's duties in a file no worker loads. The orchestrator's step 6 points at the worker skill.

Three messages are owed on an ordinary build, and a fourth on a build that turned up a row and ends before a pull request opens.

- The pull request announcement carries the number, the branch, the task it closes, and any row the build turned up, since a worker files no task file and the channel is the row's only route
- The address-review announcement carries what was addressed and the pull request's new CI state
- The block report goes out before the block becomes an interactive prompt

### Why a block is reported first

A queued message drains at the next tool round, and a session waiting on input never reaches one. An answer relayed to an open prompt renders beneath the question and changes nothing. Nothing is sent on progress, since progress reports rebuild the poll on the other side.

- A launch naming `review-address` alone reaches no `role-worker`, so a worker could address a review and tell its controller nothing
- `orchestrator-launch.md` carries a second launch shape reaching the role directly, with the same `<dispatcher-id>` resolution as the build shape
- Refusing stays a first-class move, since a worker arguing back with evidence reaches corrections a report-upward-only body would suppress

### The relay

`role-worker` and `role-planner` each state a channel and assume a message-sending tool carries it. A standalone skill for a session holding neither role never fires, because nothing routes a session to a skill matching no request.

Moving the protocol inline into each role body trades the firing problem for duplication. The content ownership table in `CLAUDE.md` decides against two copies, since a later fix reaching one diverges silently. `session-relay` keeps both properties.

- The firing condition survives because the pointer sits inside `## The channel`, a section both role bodies read at session start
- What stays duplicated is two sentences naming one skill, not the protocol
- A drifting pointer fails loudly, since the skill it names resolves or does not, where two copies of a protocol drift in silence

### A session holding neither role

Such a session has no `## The channel` section to carry the pointer, so a relay scoped to the two roles would never be found. A worker dispatched into another project is the instance. `role-worker` is barred to it because that body resolves scratch against a main worktree root a target lacks, so it names the relay directly.

The relay serves that session. It refuses neither a caller holding no role nor one holding a send tool, and its description fires on any relay rather than a missing tool.

- It holds the mechanical half of the send, being naming the sender, turning a `sessionId` or branch into an address, and sending through whichever route exists
- Each role keeps only who it addresses and its own last-rung inference, which differs because a worker holds a feature branch and a thinking session does not

### Where the send timing lives

No rule carries block-before-prompt. `session-relay` owns the send mechanics and the reason for the order, and `role-worker` and `role-planner` each state only that the message is owed first. Each keeps the operator ask and its own inference rung.

- A project installing governance without the plugin gets no surface carrying the timing, a cost the operator accepted and `canon/context/governance.md` records as an exception to its cut test
- The relay's description names a session stuck on a question that owes its dispatcher a message, the one trigger a roleless session carries nowhere else
- The routing eval is the only check that the widened description still fires

### What the announcement buys

The poll's condition is an open pull request alone rather than that or a dispatched worker, since the script reads pull requests and a building worker has none. The announcement covers the gap, because the move from building to reviewable is the one moment only the worker knows.

The dispatched-worker condition survives as a fallback for any dispatch still out after thirty minutes with no announcement, so a silent failure does not leave a finished worker unnoticed.

### The watch script

`scripts/watch.ts` covers the same window at lower cost and ships beside `poll.ts` rather than in one session's temporary directory. It reads the open pull request list and the session roster together every sixty seconds, since a crashed worker vanishes and a trigger matching only the pull request stays silent through it.

- It resolves the repository from git rather than hardcoding a path
- It counts every session on a branch other than the base as a worker, since matching an `orchestrator-` name prefix reads a dispatched worker and misses every hand-launched one

The output contract carries a third state beside `Ready to build` and `In review`, since a session holding several running workers belongs under neither. The launch section does not recommend a plan a worker is already building, since the plan file sits in place for the whole build.
