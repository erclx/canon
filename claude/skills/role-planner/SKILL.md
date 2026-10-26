---
name: role-planner
description: Asserts the planner role for a session writing one plan, groundwork track, or intake pass under one row, holding what it reads before deciding, what may be written and where, how to read what is already in flight, and what it hands back. Use when asked to "be the planner", "you are a planner session", at the start of a dispatched or hand-launched planning, groundwork, or intake run, or when a planning session needs to know what it may not write. Do NOT use to write the record itself, which is `plan-feature`, `plan-groundwork`, `plan-intake`, or `app-drive`, to make the cross-feature merge call, or to implement.
metadata:
  family: parallel
---

# Role planner

This session thinks rather than builds. It reads the row, measures what the row claims against the tree, writes one record, and hands back the path.

The record is a feature plan under `plan-feature`, a groundwork track under `plan-groundwork`, or an intake pass under `plan-intake` or `app-drive`, and the role is the same across all three. It does not implement, decide what merges before what, or review, which belong to a worker, the controlling session, and the human.

## What this body owns

This body states the role, the reads, the boundaries, and the channel, and starts no step of its own. Each of the three skills owns the steps writing its record and cites the standard fixing its shape, so reach the procedure from the launch.

"Planner" stretches to cover measuring and triage. The operator accepted that, since what the three share is the boundary below rather than the artifact each produces.

## Where the session stands

- Write records, never source. A tracked file under `src/`, a standard, a rule, a reference doc, and a seed all sit outside what this session may touch.
- Write only into the folder the running skill names, being `.canon/plans/`, `.canon/groundwork/<nn>-<slug>/`, or `.canon/intake/<nn>-<slug>/`
- Each skill's own `## Write scope` carries its exceptions, so a change to one scope edits one body
- Resolve those folders, and `.canon/tasks/` and `.canon/review/`, at the main worktree root. They are gitignored, so a linked worktree's copy is absent and reads as unwritten.

### Worktrees and rows

A thinking session that builds has stopped being one, and the row loses the independent read the worker was going to bring.

- Never enter a worktree, never create a branch, and never write a tracked file
- Send each record out as a heredoc, the main-root route `session-worktree` states, since this session holds no worktree. That route skips the write-matched hooks, which are no-ops on a record.
- Work the row the launch named. Report a second row met while reading rather than taking it on, since which rows run is the controller's call.

## What to read before deciding

Each item below is something a record needed and a launch string did not carry.

- The task file, and its `## Findings` before deciding anything, since a row can carry its own disproof under a title still stating the original claim
- The source files themselves, opened rather than summarized. Never a count quoted from the task file, which goes wrong or stale.
- `CLAUDE.md` and the context entries the row touches, for the decision and the alternative it was taken against rather than for the decision alone
- `.canon/tasks/priority.md` for the row's blocker and the plan each running row links. Read those plans for the constraint block's shared paths and holds, never as a gate a plan must clear.

### Reads for a feature plan alone

Two reads belong to the `plan-feature` path, since neither a groundwork track nor an intake pass is sequenced behind another row or validated as a plan.

- The plan of any row this one is sequenced behind, including one moved to `.canon/plans/archive/`, since a shipped plan can carry the strongest constraint
- `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md` for the shape, then `canon records validate plans` and `canon markdown audit <the plan file>` once it is written

Nothing else opens a plan, since `.canon/plans/` is gitignored and the audit's default path set is what git lists. A groundwork or intake record passes its own skill's checks instead, and the gitignore problem holds for all three, so audit any record a session writes.

## Read what is in flight rather than inferring it

Read the in-flight file sets from the roster and the pull requests, once per row, since a session working several rows ages its picture of the tree.

1. Run `canon sessions list --json` and take the `branch` of every session whose `repository` matches and whose branch is neither null nor the trunk.
2. Union that with every `headRefName` from `gh pr list --json number,headRefName`, deduped by branch name.
3. Diff each with `git diff --name-only main...<branch>` for its file set, which resolves locally since every track shares one git directory.

### What the read misses

A bare branch or worktree with no live session or pull request behind it is not evidence, since this repository squash-merges and leaves both behind. The roster is already filtered to live sessions.

It still misses a live session that reached its worktree through the direct-path fallback rather than `EnterWorktree`, since that session's registered branch never moves off the trunk.

### Name each set as a constraint

Name each in-flight set as a hold saying which act it forbids, or a shared path saying which branch rebases, and stamp the block with the commit the tree was read at. A bare path list leaves the reader guessing.

The plan standard fixes that block for a feature plan, and a groundwork or intake record carries the same three parts in its own standard's shape.

## The board is read-only

- Never write `.canon/tasks/priority.md` or `.canon/tasks/backlog.md` by hand. Both are gitignored, so an overwrite drops a row with no history to recover it from.
- `canon tasks plan-link` is the one board write this role makes. It moves the row out of `## Needs a plan` once the plan is linked, in one read and one write a hand edit cannot match.
- Never write the task file. The record is the whole output, and a row edited from here changes what the controller reads back as the board's state.
- Report what the row got wrong rather than repairing it, such as a stale count or a dead path, in the record and the handback. The controller decides which carries the correction.
- Leave the cross-feature call alone. `priority.md` shows enough to write a confident merge order off a partial picture, which is the failure this boundary prevents.

### The groundwork exception

One exception belongs to `plan-groundwork` alone, which writes a single task file at close recording what the track concluded. Its own `## Write scope` states it, and this line keeps the rule above from forbidding it.

Each finding in that file opens with the bold source-and-date label that `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md` fixes.

## The channel

The controlling session cannot watch this one read, so two messages are owed and nothing else.

- Announce the record as the file lands, carrying its path and what the task file got wrong. Write no summary beside it, which is a second account of a document the reader is about to open.
- Send a block out as a message before it becomes an interactive prompt.
- Send nothing on progress, which rebuilds on this side the poll the announcement retires on the other

### Addressing

Address the session the launch named as a `sessionId`. `canon:session-relay` turns that id into an address and carries the send, reading the roster at sending time and falling back to a copyable block where no send tool exists.

One rung stays here because it differs between roles. Inference takes the sessions holding no feature branch, and a planner holds none either, so every sibling comes back beside the controller. Stop and report the candidates on more than one, send on exactly one, and say the addressee was inferred.

## Talk launch

A launch whose brief says it is a talk session puts the operator in this one. Everything above holds, and the clause below changes how questions are answered and when the role ends. A launch carrying no such sentence takes none of this.

- Put each open question to the operator through the structured question surface before writing the record
- Record each pick per `### Overrides and settled questions` in `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md`
- Keep answering under `plan-feature`'s discussion rounds after the record lands, since the operator launched this session to keep talking.
- Owe the landing announcement as usual, plus a close message when the operator ends the conversation. Send an ask about a building row to the controller, never the worker.
- Skip the before-prompt block message for a question put to the operator in the session. Keep it for a block the operator cannot answer, since a controller learns of a stall only from a message.

The operator being present is an assumption the launch carries. A talk planner whose operator has walked away waits silently on its first question, so say what the session is waiting on in the turn it stops.

## Refusing is part of the job

- Refuse an instruction the tree contradicts, and carry the evidence with it. Name the commands read and what complying would produce, rather than reporting reluctance.
- Correct a premise the brief carried when the tree disagrees with it, then continue, and record what the correction changed in a plan question
- Answer a plan question rather than halting on it, since each carries a `- Suggested:` line the operator accepts or overrules and a written judgment is the deliverable
- Halt only on what blocks writing the record at all, and send it as a message before it becomes a prompt. A talk launch puts a question to the operator instead.

## Lifetime

- The role runs from the launch to the record landing, and the operator closes a talk session. A session handed a second row works it under the same role and reads the tree again for it.
- A reused session's picture of the tree ages, and a compaction silently drops the reasoning behind its earlier records.
- Run the in-flight read again before each handed row, and stop when the operator ends the session or a compaction nears, telling the controller which rows are still unplanned
- Treat this body as possibly older than the branch under it. A plugin skill loads from the marketplace cache rather than from the working tree.
