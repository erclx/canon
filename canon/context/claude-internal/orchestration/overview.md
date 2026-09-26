---
title: Overview
description: The task, plan, and ready-folder artifacts coordinating multi-session work, the drafting flow that archives them on merge, and the phase label boundary
---

# Overview

## Overview

`docs/workflow/operating-model.md` owns the three roles and the loop they run, reachable in a target as `canon docs operating-model`. This folder adds the artifacts the toolkit ships to make the handoff mechanical, the board they sit on, and the dispatches, reviews, and reclaims that move a row from planned to merged.

## Layout

- `.canon/tasks/` owns one gitignored file per task, the board surfaces `priority.md` and `backlog.md`, and the session maps
- `.canon/plans/` owns one gitignored plan per task, archived beside the task on ship
- `.canon/ready/` owns the finished-text folders a plan names as its verbatim source
- `claude/skills/role-orchestrator/references/` owns the orchestrator runbooks
- `claude/skills/role-orchestrator/scripts/` owns `poll.sh` and `watch.sh`, the review trigger's two loops
- `src/tasks/` owns the `canon tasks` verbs that validate, archive, and derive from the board
- `src/sessions/` and `src/worktrees/` own the roster reads and the reclaim reading

Each file covers one stage of a row's life:

- `canon/context/claude-internal/orchestration/board.md`: the board's constraints, the backlog split, row validation, and the filing boundary
- `canon/context/claude-internal/orchestration/planning.md`: the planning dispatch and the gotchas of reading a plan
- `canon/context/claude-internal/orchestration/dispatch.md`: the self-dispatch, its three gates, and what binds concurrency
- `canon/context/claude-internal/orchestration/review.md`: the review trigger, its poll and watch loops, and the handback dispatch
- `canon/context/claude-internal/orchestration/runbooks.md`: the orchestrator runbooks, the session map, and the parked-row pass
- `canon/context/claude-internal/orchestration/reclaim.md`: the reading that decides which worktree is safe to remove, and the removal routes

## The artifacts

- `.canon/tasks/vXX.Y-<slug>.md`: written by the orchestrator. One task with its outcomes and a test strategy, and the only place a phase label lives. Gitignored, shared across worktrees, archived on ship.
- `.canon/plans/feature-<slug>.md`: written by the orchestrator or a worker. Files to touch with reasons, optional constraints, risks, and answered questions for one task. Gitignored, shared across worktrees, archived on ship.
- `.canon/ready/<nn>-<slug>/`: written by the orchestrator or a warm session. Finished files laid out at their destination paths, plus a short overview. Gitignored, shared across worktrees, moved to `.canon/ready/archive/` by `canon tasks archive` on ship.

A ready folder covers the one case where a session has already written the finished text, such as a skill or a rule, rather than a description of it. It rides the existing plan and task contract: the plan's `**Constraints:**` name the ready folder as the verbatim source for the paths its `**Files to touch:**` lists, so `plan-branch`, `plan-reach`, `archive`, and dispatch all keep resolving the plan itself, unchanged. `canon tasks archive` moves the task, the plan, and the ready folder the task's `Ready:` line names. `role-worker` copies the folder's files verbatim into its worktree and edits only what the gate or the overview requires, rather than re-authoring from the plan's description. `standards/ready.md` fixes the folder's shape, and the `draft-ready` skill writes the folder, its overview, the thin plan, and the task in one invocation.

## The drafting flow

The orchestrator writes a task file through `task-board`, runs `plan-feature` to produce a plan carrying the reading list and any constraints, then hands the worker a plan slug. The worker enters a linked worktree, reads the plan, and implements.

`canon tasks archive` closes both halves in one act. The `post-merge` hook calls it with the pull request number the merge subject carries, and the verb moves the task to `.canon/tasks/archive/`, carries its plan to `.canon/plans/archive/`, and retargets the task file's `Plan:` line at the new path, so the board closes without a person naming a file. `task-board` calls the same command for the cases the hook cannot resolve.

A plan several tasks share stays live, and the count decides it rather than the folder. `otherTasksCitingPlan` in `src/tasks/archive.ts` names the other live tasks whose `Plan:` line resolves onto the same file, and only a plan nobody else holds moves. Both halves resolve the target against the board and against the project root, so `../plans/x.md` and `.canon/plans/x.md` count as one citation. `canon tasks plan-citations` exposes the same answer as `location` and `citedBy`, and reports without writing.

The move sits inside `archiveTask` rather than in a second call the hook makes after it. The hook runs with nobody watching, so a second call is a second failure point that leaves the task archived and the plan live, and what it buys is a verb whose scope stays inside `.canon/tasks/`. The cost is release lag: the hook runs the installed `canon`, so a project archives plans only once its installed release carries the move.

An operator's shell profile may wrap `canon` in a function that runs the binary and then a second command ending in something like `cd .`, so the function returns 0 whatever the binary did. It masks an ordinary refusal exactly as it masks an absent verb: `canon tasks archive` against no such stem exits 1 called directly and 0 called through such a wrapper. Every task verb tells a caller to branch on `reason` rather than on the exit, which is the rule that survives it.

### Origins

The origin invariant is owned by `standards/tasks.md`. Orchestration adds that a handoff needs more than an origin, because scope lives in the plan rather than in the task file, so a task can sit on the board plan-less and gains one when it is handed out. See Boundaries in `role-orchestrator` for the handoff rule and for the boundary that keeps tracked edits out of the main worktree.

The reverse direction of that invariant reads three origins. `task-board` lists tracks and runs an issue query, and reading intake folders needs a route of its own. The obvious signal reports the opposite of the truth: most intake folders with no live task are each cited by an archived task, which is promoted and shipped rather than abandoned, so a check keyed on board citations alone names finished folders and none of the state it exists to find.

Counting `.canon/tasks/archive/` and `.canon/tasks/declined/` beside the board separates the two, and the answer slots are read through `canon intake list --json` rather than by grepping headings, since the verb owns the parse `standards/intake.md` fixes and skips the index and every fenced sample a grep would count. The verb reports four counts per folder and the check reads three of them. `malformed` earns its own wording rather than an exclusion, because an item carrying no answer slot is neither unread nor answered, so a test reading `unread` alone folds a broken file onto the answered side and reports it as decided work nobody promoted. The step names what it read on a clean pass rather than printing nothing.

## Phase label containment

Phase labels stay inside the task board, in both the filename and the title. They never appear in PR titles or bodies, review comments, issues, commit messages, or git tags. The scan in `standards/publish.md` catches a leak on the way out, reading the label rule from `standards/versioning.md` beside it. See that file for the rules and the reasons.

A phase label absent from the live board can already belong to an archived or a declined task, since archiving or declining moves the file to `.canon/tasks/archive/` or `.canon/tasks/declined/` under its own name. `task-board` Step 2 calls `canon tasks next-label` for the next one: it reads the live board, the archive, and the declined folder together and reports the true maximum, since a board-only scan can return a duplicate an archived sibling already holds. Bare it reports rather than gates, so two sessions calling it in the same second can still land on the same answer, and `--claim` closes that: it reserves the label under `.canon/ordinal-locks/` and counts every reservation in the scan.

## Gotchas

### The plan pointer's form gates the sweep

A task's plan pointer decides whether the sweep can see it at all. A plan carried as an intro-paragraph link rather than a `Plan:` line under the title is skipped silently by `context-fold` Step 8 and by `git-pr`'s task-number write, so the plan never archives and `Pull request: #NNN` never lands. Neither skill errors, since skipping is the documented behavior when no line matches.

A task carrying no pointer in any form fails the same way and is harder to see, since a plan matched to it only by slug is stranded with no record it existed. It also reaches upstream of the archive: `auto-ship` pointed at that task stops on the plan-shape test in its own Step 1, since a task carries `## Outcomes` and `## Findings` rather than `**Files to touch:**`, and the operator has to hand the plan's own path to the skill instead.

Two task files sharing one `Plan:` line fail at the other end, tripping `git-pr`'s more-than-one-match guard so the number write skips and `canon tasks archive` never fires for the batch that closed. `standards/tasks.md` is the authority on the form.

### Archiving a plan strands the priority link

Archiving a plan at ship time leaves `.canon/tasks/priority.md` pointing at a path the file has left. `context-fold` Step 8 retargets the closing task's `Plan:` line and reads `priority.md` not at all, and `canon tasks archive` drops the row only when the hook calls it on merge, so every task sits with a dead plan link between its ship run and its merge. A board can carry several at once, from sessions other than the one reading it. Resolve the task file's own `Plan:` line, which the archive keeps current, and read a dead link in `priority.md` as the ordinary post-ship state.
