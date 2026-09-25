---
name: role-planner
description: What a thinking session is across planning, groundwork, and intake, how it reads what is in flight, the writes-records-never-source boundary, and what it hands back to whoever dispatched it
---

# Role planner requirement

## Gap

Without this skill, a planning session is told what to plan and never what it
is. `role-worker` states the building role and `auto-ship` Step 0 reaches
it on every build, so a builder takes a role whether a person launched it or a
dispatcher did. Planning has no equivalent, and two trials on 2026-08-31 ran
entirely on prose the controller retyped into each launch. That is the shape
`role-orchestrator` already bans on the building side, where one half held the
only written copy of obligations the other half performs.

Six rules went into each of those launches by hand: no worktree, no branch, no
tracked file, no board write, report the path alone, and re-measure rather than
trusting the task file. A seventh was added only after a trial got it wrong.
Every one of them is a property of the role rather than of the row, so each
dispatch reproduced them from memory and the one nobody remembered was the one
that failed.

The in-flight read is that failure. The first trial counted worktrees and local
branches and named four branches as in flight, all four of which had merged,
because this repository squash-merges and leaves both behind. A corrected brief
naming `gh pr list` as the source closed it and no constraint in the second
batch was wrong, which puts the fix in a launch string that the next dispatch
has to remember to carry.

Measuring rather than trusting the row is the other half and it is what the
trials were strongest on. Across four plans the planner reported ten things the
task files got wrong, and one plan overturned its own row's closing conclusion.
Nothing in any skill body tells a planner to open the source rather than quote
the row, so a session that skips that read produces a plan built on the same
stale count the row already carried.

A planner reading the board sees blockers and file sets and can write a
confident merge order off a partial picture. Which rows collide, what merges
before what, and whether a row should run at all stay with the controlling
session, and no body states that boundary for the planning side.

Nothing scans a plan for ban hits either. `.gitignore` ignores
`.canon/plans/`, and the audit's default path set is what git lists, so no gate
ever opens one. Six ban hits landed across the four trial plans and three of the
four carried at least one, caught only because the planner ran
`canon markdown audit` unprompted.

## Must

- Assert what a thinking session is, what it may not write, and how long the role lasts, since `plan-feature`, `plan-groundwork`, and `plan-intake` each carry their own procedure and no body carries the role the three share
- Cover all three of those skills rather than `plan-feature` alone, since a groundwork or intake session took no role at all while the body was written for one plan under one task
- State the writes-records-never-source boundary once, and name the three folders in one line while deferring each scope's exceptions to the skill that owns it, so a change to one scope edits one body
- Carry `plan-groundwork`'s close-time task file as an exception to the board ban, since widening the role without it makes the role forbid what that skill requires
- State the in-flight read as a command composing the session roster with open pull requests, and say that a branch and a worktree are not evidence, since a count of either reported merged work as live
- Run that read once per task rather than once per batch, since a reused session ages its picture of the tree while it works
- Name every read a plan needed and a launch string did not carry, the task file's findings and the source files among them, since a count quoted from a row was wrong or stale in ten places across four plans
- Name the validate and audit calls the written plan passes through, since nothing else opens a plan and the audit caught ban hits in three of four trial plans
- State the shared board as read-only and name the cross-feature call as the controller's, since a planner reading blockers and file sets can write a merge order off a partial picture and will not notice that it has
- Owe an announcement when the record lands, carrying the path and what the row got wrong, since the controller cannot watch the read happen
- Owe a message before a block becomes an interactive prompt, since a session already waiting on input never reaches the tool round an inbound message drains at
- Keep correcting the dispatcher a first-class move carrying its evidence, since a trial corrected a brief's premise, planned every row anyway, and carried the consequence into a plan question
- Point at each of the three skills for its record's shape and the steps that write it
- Defer the addressee resolution to `session-relay` and keep only the last-rung inference, which discriminates differently here than it does for a worker because a session in this role holds no feature branch either

## Must not

- Restate a record's sections, its suggested-and-answer contract, or the steps the running skill carries, since thinness is what keeps one body correct for a dispatched session reading it as its whole contract
- Restate the write-scope exceptions each of the three skills states about its own folder
- Restate a boundary `role-orchestrator` or `role-worker` states about itself
- Tell a planner to halt on a plan question, which the suggested line already answers, rather than on what blocks writing the plan at all
- Tell a planner to report the path with no account of what the row got wrong. That instruction came from a trial condition holding a blind comparison intact, and it is not a durable obligation.
- Report progress through the channel, which rebuilds on the sender's side the poll the announcement exists to retire
- Write the priority board or the backlog, at any size, or the task file outside `plan-groundwork`'s close-time exception
- Be a skill nothing invokes but its author typing the name. `orchestrator-launch.md` names it on the planning launch the way it names `role-worker` on a build, so a stretch where only a typed invocation reaches it is the signal that the role never took.

## Guards

- Task file does not resolve from where the session stands: report it unreadable and name the main-root path, rather than reporting the row as absent
- A read of what is in flight returns nothing: report that no pull request is open and no live session holds another branch, rather than falling back to a raw branch or worktree count
- Launch named no controlling session and an operator is present: ask which row to address rather than inferring
- Launch named no controlling session and nobody is present: infer from the sessions holding no feature branch, never from a name prefix, and say the addressee was inferred

## Out of scope

- Each record's sections and its answer contract, which the standard behind it fixes, and the steps that write the file, which `plan-feature`, `plan-groundwork`, and `plan-intake` each own for their own
- The write-scope exceptions, which stay in the three skills: groundwork's close-time task file, its fixture and evidence paths, and intake's statement that it has none
- The mechanical addressee resolution, which `session-relay` owns for every session with or without a role
- The branch, the build, and the pull request, which `role-worker` and `auto-ship` own
- Deciding which rows run and in what order, which is the controlling session's call and stated in `role-orchestrator`
- The dispatch itself, its collision check, and its disjointness gate, which `orchestrator-dispatch.md` holds
