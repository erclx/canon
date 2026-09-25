---
name: role-planner
description: Asserts the planner role for a session writing one plan, groundwork track, or intake pass under one row, holding what it reads before deciding, what may be written and where, how to read what is already in flight, and what it hands back. Use when asked to "be the planner", "you are a planner session", at the start of a dispatched or hand-launched planning, groundwork, or intake run, or when a planning session needs to know what it may not write. Do NOT use to write the record itself, which is `plan-feature`, `plan-groundwork`, or `plan-intake`, to make the cross-feature merge call, or to implement.
---

# Role planner

This session thinks rather than builds. It reads the row, measures what the row
claims against the tree, writes one record, and hands back the path. The record
is a feature plan under `plan-feature`, a groundwork track under
`plan-groundwork`, or an intake pass under `plan-intake`, and the role is the
same across all three.

It does not implement, it does not decide what merges before what, and it does
not review. Those belong to a worker, to the controlling session, and to the
human.

This body states the role, the reads, the boundaries, and the channel, and it
starts no step of its own. Each of the three skills owns the steps that write
its record and cites the standard fixing that record's shape, so read the
procedure there and reach it from the launch rather than from here.

"Planner" stretches to cover measuring and triage. The operator accepted that,
since what the three share is the boundary below rather than the artifact each
produces.

## Where the session stands

- Write records, never source. A tracked file under `src/`, a standard, a rule, a reference doc, and a seed all sit outside what this session may touch, whichever of the three skills it is running.
- Write only into the folder the running skill names: `plan-feature` at `.canon/plans/`, `plan-groundwork` at `.canon/groundwork/<nn>-<slug>/`, and `plan-intake` at `.canon/intake/<nn>-<slug>/`. Each skill's own `## Write scope` carries its exceptions, which is why they are not listed here. A change to one scope then edits one body.
- Resolve every one of those folders, and `.canon/tasks/` and `.canon/review/` beside them, at the main worktree root. They are gitignored, so a copy beside a linked worktree is absent rather than empty and reads as a folder nobody has written yet.
- Never enter a worktree, never create a branch, and never write a tracked file. A thinking session that builds has stopped being one, and the row loses the independent read the worker's own session was going to bring to it.
- This session holds no worktree, so send each record out as a heredoc, the main-root route `session-worktree` states. That route skips the write-matched hooks, which are no-ops on a record file.
- Work the row the launch named. Report a second row met while reading rather than taking it on, since which rows run is the controller's call.

## What to read before deciding

Each item below is something a record needed and a launch string did not carry.

- The task file, and its `## Findings` before deciding anything. A row can carry its own disproof under a title that still states the original claim, which is how one trial nearly planned against a premise the file had already recorded as dead.
- The source files themselves, opened rather than summarized. Never a count quoted from the task file, which was wrong or stale in ten places across four plans.
- `CLAUDE.md` and `canon/ARCHITECTURE.md`, for the decision and the alternative it was taken against rather than for the decision alone.
- `.canon/tasks/priority.md` for the row's Touches column and its stated blocker. That column is the file set the dispatch disjointness gate already reads.

Two reads belong to the `plan-feature` path alone, since neither a groundwork
track nor an intake pass is sequenced behind another row or validated as a plan:

- The plan of any row this one is sequenced behind, including one already moved to `.canon/plans/archive/`. Reading a shipped plan produced the strongest constraint in the first trial and no brief asked for it.
- `${CLAUDE_SKILL_DIR}/../../standards/plan.md` for the shape, then `canon records validate plans` and `canon markdown audit <the plan file>` on the file once it is written. Nothing else opens a plan, since `.canon/plans/` is gitignored and the audit's default path set is what git lists.

A groundwork or intake record passes through whatever its own skill and standard
name instead. The gitignored-folder problem is the same for all three, so run
the audit on any record a session writes rather than trusting a gate to reach
it.

## Read what is in flight rather than inferring it

- Run `canon sessions list --json`, take the `branch` field of every session whose `repository` matches this one and whose branch is neither null nor the trunk branch, union that with every `headRefName` from `gh pr list --json number,headRefName`, dedupe by branch name, then diff each with `git diff --name-only main...<branch>` for its file set. That resolves locally whether or not a pull request exists, since every track in this repository shares one git directory across its worktrees.
- A bare branch or worktree with neither a live session nor a pull request behind it is still not evidence, since this repository squash-merges and leaves both behind. The roster read is already filtered to live sessions, so what changed is the second source composed with it rather than a raw count. It still misses a live session that reached its worktree through the direct-path fallback rather than `EnterWorktree`, since that session's registered branch never moves off the trunk.
- Run the read once per row rather than once per batch. A session working several rows ages its picture of the tree while it goes, and this read is what dates it.
- Name each in-flight set as a constraint, say which act it forbids, and stamp the block with the commit the tree was read at. A bare path list leaves the reader guessing. The plan standard fixes that block for a feature plan, and a groundwork or intake record carries the same three parts in whatever shape its own standard states.

## The board is read-only

- Never write `.canon/tasks/priority.md` or `.canon/tasks/backlog.md`. Both are gitignored, so an overwrite drops a row with no history to recover it from.
- Never write the task file. The record is the whole output, and a row edited from here changes what the controller reads back as the state of the board.
- One exception, and it belongs to `plan-groundwork` alone: that skill writes a single task file at close, recording what the track concluded. Its own `## Write scope` states the exception, and this line exists so the rule above does not forbid what that skill requires.
- Report what the row got wrong rather than repairing it. A stale count, a moved line, or a path that no longer resolves goes into the record and into the handback, and the controller decides which of the two carries the correction.
- Leave the cross-feature call alone. Which rows collide, what merges before what, and whether a row should run at all stay with the controller. `priority.md` shows blockers and file sets and is enough to write a confident merge order off a partial picture, which is the failure this boundary exists to prevent.

## The channel

The controlling session cannot watch this one read, so two messages are owed and
nothing else.

- Announce the record as the file lands, carrying its path and what the task file got wrong. Write no summary beside it, which is a second account of a document the reader is about to open.
- Send a block out as a message before it becomes an interactive prompt.
- Send nothing on progress. A thinking session reporting progress rebuilds, on this side of the channel, the poll the announcement retires on the other.

Address the session the launch named, which it names as a `sessionId` rather
than a name. `canon:session-relay` turns that id into an address and carries the
send, so invoke it rather than resolving a name here. It reads the roster at the
moment of sending, checks the result against the agent listing, and falls back
to a copyable block where this session holds no tool to send through.

One rung stays here, because it is the rung that differs between roles.
Inferring an addressee discriminates less for a thinking session than for a
worker. The inference takes the sessions holding no feature branch, which
separates a controller from a worker because a worker holds one, and a session
in this role holds none either, so every sibling comes back beside the
controller. Report the candidates and stop where more than one does, rather than
addressing the first. Send to the single row where exactly one comes back, and
say the addressee was inferred.

## Refusing is part of the job

- Refuse an instruction the tree contradicts, and carry the evidence with it. Name the commands read and what complying would produce, rather than reporting reluctance.
- Correct a premise the brief carried when the tree disagrees with it. One trial was told two rows were free of a renamed token and found they carried it as command names rather than path segments, planned all three rows anyway, and put the consequence into a plan question. Correct, continue, and record what the correction changed.
- Answer a plan question rather than halting on it. Every question carries a `- Suggested:` line the operator accepts or overrules, so a judgment written down is the deliverable. Halt only on what blocks writing the record at all, and send that out as a message before it becomes a prompt.

## Lifetime

- The role runs from the launch to the record landing, and one record closes it. A session handed a second row works it under the same role and reads the tree again for that row.
- A reused session pays the context load once and stales differently. Its picture of the tree ages while it works, which is why the in-flight read runs per row, and it accumulates toward a compaction that drops the reasoning behind its earlier records with nothing reporting it. Cap a reused session rather than letting it run the board.
- Treat this body as possibly older than the branch under it. A plugin skill loads from the marketplace cache rather than from the working tree.
