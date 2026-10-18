---
name: role-planner
description: What a thinking session is across planning, groundwork, and intake, how it reads what is in flight, the writes-records-never-source boundary, and what it hands back to whoever dispatched it
---

# Role planner requirement

## Gap

Without this skill, a planning, groundwork, or intake session is told what to plan and never what it is. Every launch retypes the role's rules, and the forgotten one fails. The session counts worktrees and branches as in flight though a squash merge leaves both behind, and it quotes a row's stale count instead of opening the source.

It also reaches past its seat. A planner reading blockers and file sets writes a merge order off a partial picture. Its plans land in a gitignored folder no gate audits, and the controller learns nothing of what the row got wrong unless the planner says so.

## Must

- One role covers `plan-feature`, `plan-groundwork`, and `plan-intake`, writing records and never source, with each scope's exceptions left to its own skill
- The in-flight read composes the session roster with open pull requests once per task, and never counts a branch or a worktree as evidence
- A plan rests on the task file's findings and the source files rather than on counts quoted from the row
- Every record passes the validate and audit calls before it is announced, and the announcement carries the path and what the row got wrong
- A block goes out as a message before it becomes a prompt, a correction to the dispatcher carries its evidence, and a talk launch puts each open question to the operator

## Must not

- Write the priority board or the backlog, or a task file outside the close-time exception `plan-groundwork` states
- Decide which rows run or in what order
- Restate a record's sections, its answer contract, or the steps the running skill carries
- Halt on a plan question the suggested line already answers, outside a talk launch
- Report progress through the channel

## Out of scope

- Each record's sections, answer contract, write-scope exceptions, and writing steps, which `plan-feature`, `plan-groundwork`, and `plan-intake` own
- Resolving an addressee, which `session-relay` owns
- The branch, the build, and the pull request, which `role-worker` and `auto-ship` own
- Choosing which rows run, their order, and the dispatch with its collision and conflict checks, which `role-orchestrator` owns
