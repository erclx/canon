---
title: Overview
description: The task, plan, and ready-folder artifacts coordinating multi-session work, the drafting flow that archives them on merge, and the phase label boundary
---

# Overview

## Overview

`docs/workflow/operating-model.md` owns the three roles and the loop they run, reachable in a target as `canon docs operating-model`. This folder adds the artifacts that make the handoff mechanical, the board they sit on, and the dispatches, reviews, and reclaims that move a row from planned to merged.

## Layout

- `.canon/tasks/` owns one gitignored file per task, the board surfaces `priority.md` and `backlog.md`, and the session maps
- `.canon/plans/` owns one gitignored plan per task, archived beside the task on ship
- `.canon/ready/` owns the finished-text folders a plan names as its verbatim source

### Skill and source folders

Four folders hold the code and runbooks behind the board.

- `claude/skills/role-orchestrator/references/` owns the orchestrator runbooks
- `claude/skills/role-orchestrator/scripts/` owns `poll.ts`, `watch.ts`, and the `repo.ts` they share
- `src/tasks/` owns the `canon tasks` verbs that validate, archive, and derive from the board
- `src/sessions/` and `src/worktrees/` own the roster reads and the reclaim reading

### Entries by stage

Each file in this folder covers one stage of a row's life.

| File          | Covers                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| `board.md`    | The board's constraints, the backlog split, row validation, and filing  |
| `planning.md` | The planning dispatch and the gotchas of reading a plan                 |
| `dispatch.md` | The self-dispatch, its three gates, and what binds concurrency          |
| `review.md`   | The review trigger, its poll and watch loops, and the handback dispatch |
| `poll.md`     | How the poll classifies a pull request, its readings, and its harness   |
| `runbooks.md` | The orchestrator runbooks, the session map, and the parked-row pass     |
| `reclaim.md`  | Which worktree is safe to remove, and the removal routes                |

### The artifacts

Three gitignored artifacts are shared across worktrees and archived on ship.

- `.canon/tasks/vXX.Y-<slug>.md` is written by the orchestrator. One task with its outcomes and test strategy, and the only place a phase label lives.
- `.canon/plans/feature-<slug>.md` is written by the orchestrator or a worker. Files to touch with reasons, constraints, risks, and answered questions.
- `.canon/ready/<nn>-<slug>/` is written by the orchestrator or a warm session. Finished files at their destination paths plus a short overview, moved to `.canon/ready/archive/` on ship.

### Ready folders

A ready folder covers the case where a session has already written the finished text, such as a skill or a rule. It rides the existing plan and task contract, so `plan-branch`, `plan-reach`, `archive`, and dispatch resolve the plan unchanged.

- The plan's `**Constraints:**` name the folder as the verbatim source for the paths its `**Files to touch:**` lists
- `canon tasks archive` moves the task, the plan, and the folder the task's `Ready:` line names
- `role-worker` copies the files verbatim and edits only what the gate or the overview requires
- `claude/skills/draft-ready/references/ready.md` fixes the shape, and `draft-ready` writes the folder, overview, thin plan, and task in one invocation

## Decisions

### The drafting flow

The orchestrator writes a task file through `task-board`, runs `plan-feature` to produce a plan with the reading list and constraints, then hands the worker a plan slug. The worker enters a linked worktree, reads the plan, and implements.

`canon tasks archive` closes both halves in one act. The `post-merge` hook calls it with the pull request number the merge subject carries.

- The verb moves the task to `.canon/tasks/archive/` and the plan to `.canon/plans/archive/`
- It retargets the task's `Plan:` line at the new path, so the board closes without a person naming a file
- `task-board` calls the same command for the cases the hook cannot resolve

### Shared plans stay live

A plan several tasks share stays live, and the count decides it rather than the folder. `otherTasksCitingPlan` in `src/tasks/archive.ts` names the other live tasks whose `Plan:` line resolves onto the same file, and only a plan nobody else holds moves.

- Both halves resolve the target against the board and the project root, so `../plans/x.md` and `.canon/plans/x.md` count as one citation
- `canon tasks plan-citations` exposes the answer as `location` and `citedBy`, and reports without writing

### The `Plan:` line

Every reader and writer locates the line through `planLineIndex`, the first `Plan:` line outside a fenced sample, and reads every target on it. A line linking several distinct plans is the shape a sliced task carries.

- The board check reads it whole and reports `plan-several` only for one plan listed twice
- Archive and decline move each live plan it names that no other task holds, and `plan-citations` reports `several`
- `plan-link` refuses it unless given `--add`, which appends one plan per slice
- The retarget runs before the task's links are rebased, so the rebase carries each moved target into the archive like any other link

### Why the move sits inside archiveTask

The move sits inside `archiveTask` rather than in a second call the hook makes after it. The hook runs unattended, so a second call is a second failure point that leaves the task archived and the plan live. The alternative bought a verb scoped to `.canon/tasks/`.

The cost is release lag. The hook runs the installed `canon`, so a project archives plans only once its installed release carries the move.

### Wrapped `canon` hides exit codes

An operator's shell profile may wrap `canon` in a function that runs the binary and then a second command ending in something like `cd .`, so the function returns 0 whatever the binary did. It masks an ordinary refusal as it masks an absent verb, and `canon tasks archive` against no such stem exits 1 direct and 0 through the wrapper.

Every task verb tells a caller to branch on `reason` rather than on the exit, which survives the wrapper.

### Origins

`claude/skills/task-board/references/tasks.md` owns the origin invariant. Orchestration adds that a handoff needs more than an origin, because scope lives in the plan, so a task can sit on the board plan-less and gains one when handed out. See Boundaries in `role-orchestrator` for the handoff rule.

### Reading intake origins

The reverse direction reads three origins. `task-board` lists tracks and runs an issue query, and intake folders need a route of their own. The obvious signal reports the opposite of the truth, since most intake folders with no live task are each cited by an archived task, promoted and shipped rather than abandoned.

- Counting `.canon/tasks/archive/` and `.canon/tasks/declined/` beside the board separates the two
- Answer slots are read through `canon intake list --json`, since the verb owns the parse `claude/skills/plan-intake/references/intake.md` fixes and skips the index and fenced samples a grep would count
- The verb reports four counts per folder and the check reads three
- `malformed` earns its own wording. An item with no answer slot is neither unread nor answered, and reading `unread` alone reports it as decided work.
- The step names what it read on a clean pass rather than printing nothing

### Phase label containment

Phase labels stay inside the task board, in both the filename and the title. They never appear in PR titles or bodies, review comments, issues, commit messages, or git tags. The scan in `claude/skills/git-pr/references/publish.md` catches a leak on the way out, reading the rule from `claude/skills/git-commit/references/versioning.md`.

### Finding the next label

A label absent from the live board can belong to an archived or declined task, since archiving or declining moves the file under its own name. `task-board` Step 2 and `draft-ready` Step 2 call `canon tasks next-label`, which reads the live board, the archive, and the declined folder together and reports the true maximum.

Bare, it reports rather than gates, so two sessions calling in the same second can land on the same answer. `--claim` closes that by reserving the label under `.canon/ordinal-locks/` and counting every reservation in the scan.

## Gotchas

### The plan pointer's form gates the sweep

A task's plan pointer decides whether the sweep can see it. A plan carried as an intro-paragraph link rather than a `Plan:` line under the title is skipped silently by the `git-pr` task-number write, so `Pull request: #NNN` never lands and the merge never archives the plan. Nothing errors, since skipping is documented behavior.

- A task with no pointer in any form fails the same way and is harder to see, since a plan matched only by slug is stranded with no record it existed
- It also stops `auto-ship` pointed at that task on the Step 1 plan-shape test, since a task carries `## Outcomes` rather than `**Files to touch:**`. Hand it the plan's path.
- Two task files sharing one `Plan:` line trip the `git-pr` more-than-one-match guard, so the number write skips and `canon tasks archive` never fires for the batch that closed
- `claude/skills/task-board/references/tasks.md` is the authority on the form

### Archiving a plan strands the priority link

Archiving a plan leaves `.canon/tasks/priority.md` pointing at a path the file has left wherever another row still names it. `canon tasks archive` retargets the closing task's `Plan:` line and drops that task's own row, and reads no other row, so a sibling row naming the same plan keeps a dead link after the merge.

Resolve the task file's own `Plan:` line, which the archive keeps current, and read a dead link in `priority.md` as a row `canon tasks validate` reports.
