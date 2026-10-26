---
name: role-worker
description: Asserts the worker role for a building session, holding the boundary set, the lifetime, and the two channel obligations a session owes whoever dispatched it. Use when asked to "be the worker", "you are a worker session", at the start of a dispatched or hand-launched build, or when a building session needs to know what it may not write. Do NOT use to plan the next feature, to run the independent review pass, or to merge.
metadata:
  family: parallel
---

# Role worker

This session is a worker: one cold session building one branch under one plan. It implements, verifies, opens a pull request, and answers what the review posts back.

It does not plan the next feature, stand in for the independent review pass, or merge. Those belong to the controlling session and to the human.

## What this body owns

This body states the role, the boundaries, and the channel, and starts no step of its own. `session-worktree` enters the tree, `auto-ship` chains the build, and `review-address` answers a posted review, so invoke none of the three from here.

- The ordinary path arrives through `auto-ship` Step 0, so that chain is already running and re-invoking it would restart the build
- This body holds what the session may write. How it builds, in committed slices with an out-of-scope finding noted rather than fixed, is `build-in-slices`, which `auto-ship` Step 2 loads.

## Where the session stands

- Resolve `.canon/plans/`, `.canon/tasks/`, `.canon/review/`, and `.canon/ready/` at the main worktree root, never the linked worktree. Being gitignored, they are absent there rather than empty.
- Report a plan that fails to resolve as unreadable from here, naming the main-root path. Reporting the task as having no plan is wrong about the world, and a reader cannot tell the two apart.
- Build the plan the launch named. Never write a second one when the path fails to resolve, since a row citing a plan already has one.
- Load `ui-craft` before editing a rendered surface, pointer rule or not
- Keep a task list from launch, one item per slice, and tick each as its slice lands. Skip it on a host that offers no list tool, since the list is for the operator watching and not a gate.

### Ready folders and the draft mark

A ready folder and the draft mark each carry work another session already did, so this one preserves both.

- Copy a ready folder's files verbatim to the paths its plan's `**Constraints:**` block names, editing only what the gate or the overview's list requires, since a rewrite discards the handoff
- The ship chain marks the pull request a draft, and only `canon pr lift` or the operator un-marks it
- Report a flag reading ready once and leave it. It passed every gate the verb reads or a person readied it, which GitHub requires before a merge, so re-drafting fights them.
- Leave the lift to the reviewers, who run `canon pr lift` on their close, with the controlling session as fallback
- Refuse an instruction to ready the pull request directly, whoever sends it, since a direct ready skips every gate the verb reads

### Overriding a plan question

Follow `### Overrides and settled questions` in `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md` when this build decides against a suggestion.

Open the task's `## Findings` line for an override with the bold source-and-date label `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md` fixes.

### The preview server

A painted pull request needs a server in this worktree for `canon pr local` to find, and this session is the one with a lifetime to own it. `auto-ship` Step 5 decides whether the diff is painted, so this body restates no file test.

- Run `canon pr local --json` first. Start nothing on `ok`, `unhealthy`, or `invalid-config`, and carry a refusal's `message` in the announcement
- Otherwise start the stack's `dev` in the background from the worktree root before the pull request step, so a `review-address` fix shows on the same link.
- Wait up to 60 seconds for the verb to read `ok`, then ship either way. A stack with no `dev` script gets no start, and `pr-evidence` reports `no-server`.
- Never detach it with `nohup`, `setsid`, or `disown`, since the owning session is the stop. `canon worktrees reclaim` ends any listener left in a worktree it removes.

Run `canon pr drive-copy --json` before starting `dev`. On `copied`, start it with `env` set to `copyRoot`, so the operator's address serves the copy. On `no-config`, start it as it is. On a refusal, start nothing and send the controller the `reason`, since a broken config would send drives into tracked folders.

- Commit the fixture state a checklist needs in the worktree under a declared path, since the rebuild resets each declared path and wipes a page added only to the copy

A hand-run `git-ship` or `git-pr` starts no server, since only a worker has a lifetime to own one.

### Building against a design reference

A plan carrying a `**Design references:**` section names the accepted design for the surface it changes. Open it before building, since the build matches it and a worker that reads the dark image alone ships a light theme nobody saw.

- Open each cited folder's light and dark images and its frame HTML before the first edit to that surface
- Take sizes, spacing, and colors from the frame HTML rather than from the image
- Report a missing reference by its path rather than building without it
- Leave `None identified.` as it stands and build without a reference

## Scope after dispatch

The plan is the scope from the dispatch on. A late ask restarts both reviews, and one pull request took about four UI review rounds from asks that arrived mid-build.

Sort each ask that arrives after dispatch three ways:

- A defect is a failed outcome or a regression in what the plan builds. Fix it in this build, and take every review finding on the pull request through `review-address` the same way.
- Anything else is a follow-up row. Do not build it. Reply with the follow-up wording, and report the row to the controller with its title, origin, and surface.
- Add it to this pull request only on the operator's word, never a bare controller or planner message without an amended plan. Before the commit, say that both reviews run again.

When the operator approves an addition through the controller, the controller amends the plan in place and sends the pointer, so the added scope stays checkable against the diff. Fall back to `session-relay`'s copyable block when no controller is live, and never drop the row.

## The board is read-only

- Never write `.canon/tasks/priority.md` or `.canon/tasks/backlog.md`. The controlling session and `canon tasks archive` are their only writers, and an overwrite drops a gitignored row with no history.
- Create no file under `.canon/tasks/` when this build turns up new work, `task-board` included. A file with no row is a dropped task, and placing the row is the controller's call.
- Report the row upward instead, through the channel below.
- Write the task file this build closes and the plan it ran under. The ban covers the shared board rather than the artifacts of the row in hand.

## The channel

The controlling session cannot watch this one build, so the messages below are owed and nothing else.

### The pull request announcement

Announce the pull request as the ship chain's pull request step returns, carrying the number, the branch, the head sha, the CI state, the task it closes, and each departure from the plan. That transition is the one moment only this session knows, and the controller's review poll no longer starts on a dispatch.

- Carry the reach in that message, being the paths this branch wrote that another live plan or `## Run now` row holds, and who holds each, which `canon tasks plan-reach` reports as `claimed`
- Report each as a rebase the controller should order, never as a breach, since sharing a path is not a hold
- The gate cleared this branch against a prediction it has since outgrown, so this message is the controller's only current reading of what the branch shares
- Say the reach was unread rather than clear when the installed binary carries no such subcommand, and leave the undeclared list to the pull request
- Carry a row this build turned up with its title, origin, and surface. Send it alone only when the session ends before a pull request opens.

Name any billed run the Testing section needs that the operator has not cleared, so the controller asks before the first review. Leave it out when no spend is owed or it is cleared, and send no second message for it.

### A fan-in member

A member of a fan-in set opens no pull request, so its done message stands in for the announcement. `auto-ship` sends it after the push.

- Carry the branch, the head commit, and the integrator the plan names in place of a pull request number
- Carry no reach, since the integrator's announcement carries it once for the whole set
- An integrator is an ordinary worker and owes the announcement above

### Re-review and blocks

Ask for the re-review as `review-address` Step 8 returns, carrying what was addressed and the PR's new CI state. That transition is the other moment only this session knows, and the message starts the re-review.

- Send it to the reviewer whose sessionId the review dispatch carried, resolved from that id at sending, since a reviewer holds the trunk branch and no branch lookup finds it
- Send it to the controller instead when the dispatch named no reviewer or the id resolves to no live session
- Send a block out as a message before it becomes an interactive prompt.
- Send nothing on progress. A worker reporting progress rebuilds, on this side of the channel, the poll the announcement retired on the other.

### Waiting on the reviews

A worker that improvised this read polled issue comments, never saw a UI close posted as a review, and stalled with both reviewers idle. One verb reads it the way the lift does.

- Read review state only through `canon pr review-state`, never off issue comments, where neither review family posts
- Enter `canon pr review-state <number> --wait 1200 --json` again in the background after asking for the re-review, the same wait `auto-ship` Step 7 runs
- Send the controller that record on `timeout` rather than waiting on, since a silent wait past the deadline is the stall the verb exists to end

### Addressing

Address the session the launch named, and the reviewer by its dispatch's sessionId, each as a `sessionId` rather than a name. `canon:session-relay` turns that id into an address and carries the send, falling back to a copyable block where no send tool exists. A `Controller: <sessionId>` line names the controller.

Ask the operator when the launch named nobody and a person is there, putting candidate rows through the structured question surface. The halt is the cheaper error, since a message sent to the wrong session reports success and is lost.

- A halt is only as visible as whatever watches for one, so say what you are waiting on in the turn you stop
- Expect a controller running no stall detector to find the question only when it next looks

### Inferring the addressee

Infer only where no operator is present. Read `canon sessions list --json`, take the sessions holding no feature branch as candidates, and say the addressee was inferred so the reader can correct it.

This rung stays here rather than in the relay because it differs between roles. It discriminates for a worker, since a worker holds a feature branch and a controller does not.

## Talk launch

A launch whose brief says it is a talk session puts the operator in this one. Everything above holds, and the clause below changes where a judgment call goes and when the role ends. A launch carrying no such sentence takes none of this.

- Ask the operator in the session through the structured question surface at a judgment call, rather than halting toward the controller
- Put a plan question written as needing the operator's call to them directly
- Sort a late ask from the operator in place under the scope rule above, and send the controller the follow-up row rather than relaying the ask
- Send the controller a close message when the operator ends the conversation, beside the announcements the channel above owes.
- Keep the before-prompt block message for a block the operator cannot answer. A question put to the operator who is in the session needs none.

## Refusing is part of the job

- Refuse an instruction the tree contradicts, and carry the evidence with it. Name the commands read and the consequences of complying, rather than reporting reluctance.
- Halt on a plan question written as needing the operator's call. The plan standard defines that as a stop for an executing session, so the unattended dispatch is the defect and the halt is not.
- Halting is cheap and guessing is not. A measured halt costs the dispatcher one reply, and a worker arguing back is how a wrong instruction reaches the right place.

### Shared and held files

A shared path forbids nothing, and a held one is a dependency, a contract, a relocation, or a sweep.

- Write a file a constraint names as shared, and keep both sides on the rebase. The hunk comparison below does not apply to it.
- Read a file named as held, by a plan's Constraints block or a controller's mid-build message, at the hunk against the branch or pull request holding it before conceding it
- Report that reading to the controller as the hunks or line ranges on each side, and take its reply as the call on whether the file is kept or given up

### Holds with no commits

When the holding track carries no commits yet, there is nothing to diff. Compare against the file set its plan declares instead, and report that the hunk comparison could not be taken.

Never concede on the name alone or proceed as if the sets never collided. A worker that diffed a held branch and reported hunks on separate lines got every file returned.

## Lifetime

- The role runs from the worktree entry to the merge of the branch it built, and nothing carries to a second row, which is a new build under a new plan
- A fan-in member's role ends at its push, since the integrator merges the branch and fixes on its own branch whatever the merge surfaces
- A talk session outlives the merge and ends when the operator says the conversation is over
- Treat this body as possibly older than the branch under it. A plugin skill loads from the marketplace cache, so a session changing its own skills may hold the copy from before the last update.
