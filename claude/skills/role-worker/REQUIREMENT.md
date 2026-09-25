---
name: role-worker
description: What a building session is, the shared surfaces it may not write, and the two messages it owes the session that dispatched it
---

# Role worker requirement

## Gap

Without this skill, a building session is told what to do and never what it is. One shipped body asserts a session role and it is the orchestrator, so worker behavior spreads across three skills that each own a step and none of them names the role or the channel it runs on. The handback works because a session reading plain text tends to follow it rather than because anything says it should, which held while a person launched every worker and stopped holding the first time one ran with nobody watching.

The session then writes surfaces nothing told it were shared. One worker split a concern its own run could not reach, hand-wrote the priority board from a copy taken minutes earlier, and reverted a promotion with nothing reporting it, on a board that still validated afterwards because a reverted row is a well-formed board. A second added a row and labelled it with an identifier another row already held. The rule against both sits inside the controlling session's own body, which no worker loads.

Standing in a linked worktree fails one step earlier and reports confidently while it does. The plan folder is gitignored, so `git worktree add` never creates it, and a worker reading it from the build tree reports that the task has no plan. That is true from where the session stands and wrong about the world, and a reader holding no second tree cannot tell those apart. Three workers hit it in one day and an absolute path unblocked all three.

A blocked worker reaches nobody at all. Two dispatched sessions opened an interactive prompt inside a background session no operator was attached to, and the roster read both as alive throughout. An answer relayed afterwards arrives and does not land, since a queued message drains at the next tool round and a session waiting on input never reaches one, so the channel closes the gap only when it is used before the prompt opens. One of the two held uncommitted work across three files, which made stopping and relaunching a destructive recovery rather than a free one.

Finishing is invisible from the other side. A worker that opens a pull request goes idle rather than exiting, so the one push signal available fired for a worker that was stopped and never fired for the one that finished, which then sat unnoticed for eighteen minutes. Polling covers that interval by spending a fixed cost against a worker with no pull request to report, measured as five consecutive runs reporting no movement across roughly fifteen minutes while one worker built.

Nothing tells the session that refusing is allowed either. Four occasions across two days had a worker halt correctly with the cost falling on the dispatcher, and the correction that mattered most reached the right place because a worker argued back with evidence rather than complying. A role written only as report-upward suppresses exactly that.

The draft mark fails from both ends. On 2026-08-31 four sessions re-drafted a pull request someone had readied, acting on a belief no surface in the tree stated. On 2026-09-07 a controlling session told a worker to lift the mark rather than lifting it itself, and the worker complied and reported against the surface rather than the outcome.

## Must

- Assert what a building session is, what it may not do, and how long the role lasts, since the three step-owning skills each carry a procedure and none carries a role
- State that session scratch resolves at the main worktree root, since a linked worktree holds none of those folders and their absence reads as a missing artifact rather than as a wrong vantage
- State the shared board as read-only for a building session and name what it does instead when a row is owed, since a worker cannot pick a free label without reading every task file and every archive entry
- Owe an announcement the moment the pull request opens, carrying the number, the branch, and the task, since that transition is the one interval only the worker can observe
- Owe a message before a block becomes an interactive prompt, since a session already waiting on input never reaches the tool round an inbound message drains at
- Name the addressee as the session the launch named, falling back to the roster and saying so, since an operator's own launch names nobody
- Keep refusing a dispatcher a first-class move carrying its evidence, since the halts measured so far were correct and the cost of each fell where it belonged
- State that a held body may be older than the branch under it, since a plugin skill loads from the marketplace cache rather than from the working tree
- Point at `session-worktree`, `auto-ship`, and `review-address` for the steps each already owns

## Must not

- Restate a procedure any of the three step-owning skills carries, since thinness is what keeps one body correct for a dispatched worker reading it as its whole contract and for a hand-launched one reading it beside a person
- Restate a boundary the orchestrator already states about itself
- Report progress through the channel, which rebuilds on the sender's side the poll the announcement exists to retire
- Write the priority board or the backlog, at any size
- Be a skill nothing invokes but its author typing the name. `auto-ship` Step 0 invokes it on every build, dispatched or hand-launched, so a stretch where only a typed invocation reaches it is the signal that the role never took.

## Guards

- Plan path does not resolve from inside the worktree: report it unreadable from here and name the main-root path, rather than reporting the task as having no plan
- Plan carries a suggestion written as needing the operator's call: halt and message, rather than answering it
- Launch named no controlling session: resolve from the roster, address the match, and say the addressee was inferred
- No live session holds the other end: report what would have been sent and stop, rather than retrying or waiting

## Out of scope

- Entering the worktree, which `session-worktree` owns
- The chain from implement through pull request, which `auto-ship` owns
- Answering a posted review, which `review-address` owns
- The controlling session's half of the channel, the review poll, and the watch beside it, which `role-orchestrator` and its runbooks hold
