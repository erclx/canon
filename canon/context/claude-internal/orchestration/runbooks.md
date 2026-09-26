---
title: Runbooks
description: The orchestrator runbooks under role-orchestrator, the session map a compaction writes and resume reads, and the parked-row pass the sweep fires
---

# Runbooks

## The runbook set

Runbooks under `claude/skills/role-orchestrator/references/` cover the moments the model cannot detect on its own, beside the refill, handback, review fallback, and output shapes the body moved out to stay under the length ceiling. `orchestrator-sweep.md` triggers the queue refill after a batch of merges, and `orchestrator-parked.md` re-tests a row already parked, on the opposite trigger. `orchestrator-poll.md` holds the review trigger, covered in `canon/context/claude-internal/orchestration/review.md`. `orchestrator-dispatch.md` holds the self-dispatch checks and `orchestrator-launch.md` the launch templates, both covered in `canon/context/claude-internal/orchestration/dispatch.md`. `orchestrator-handoff.md` and `orchestrator-resume.md` are the two sides of a compaction.

The runbooks ship inside the skill because a runbook the skill cites has to resolve for a project holding the plugin and running no install, and the human fires the two compaction sides by asking for them once the skill is loaded. The routing lives in the body and the skill is user-invoked, so a long session that has dropped the body routes nothing, which is why the body names re-invocation and the two runbook paths as one recovery.

## The session map

`orchestrator-handoff.md` covers the write side of a compaction and `orchestrator-resume.md` the read side, both over the session map `standards/session.md` governs. The standard holds what any session can fill: the three core sections, the per-session filename, the capture and drift steps that open the write, and the citation rule. The `session-map` skill is the invocable route onto it, which the runbook calls rather than restating.

A plain session about to compact takes `session-compact` instead, which writes a note under `.canon/compact/` and leaves the board alone, and the `PreCompact` hook names that skill and points this role at its own runbook. The runbook holds what the role adds over that call: the section for decisions taken under delegated authority, the closing block that restarts the review poll, and the caveat that this session never commits, which the door takes and passes to capture so no fact routes into a tracked file. All three are settled before the door writes, since the door reports the map as written and knows nothing of the role.

A fourth act settles ahead of those three and puts nothing in the map at all. The runbook retires the sessions this wave delivered, per `canon/context/claude-internal/orchestration/reclaim.md`, and it runs first because a session retired after the write is one the map already listed as running.

### Split by role

Splitting on role rather than on file is what lets a feature session write a handoff at all. A worker holds no delegation to have exercised and runs no review poll, so lifting the whole runbook would hand it two sections it can only leave blank, and a blank section teaches its reader to skip the file. The drift step sits in the standard on the opposite test: the failure it detects follows session length rather than role, so a long worker session writing a handoff while following a body the repository has moved past is the case the step exists for.

The standard sits in the flat `standards/` root rather than in a skill's `references/`, because two skills read it and a skill body may not cite a path inside a sibling skill. The root reaches both callers through the corpus the plugin ships beside `skills/`, so a project holding the plugin resolves it and a project holding neither runs `canon standards session`.

### One file per session

One file per session keeps two writers off one path. `session-<slug>.md` takes the branch-derived slug, so two sessions closing near each other write different files and the reader takes the newest by modification time. A declared section ownership over one file was the alternative and it asks two sessions to cooperate on a write neither can watch the other make. The cost is a folder to scan rather than a known path, which the newest-wins read absorbs on the common path. `RESERVED_STEMS` in `src/tasks/archive.ts` carries the prefix so neither task verb counts a handoff as a task carrying no row.

The one file per session lands on the board catalog, which filters nothing and gains a row per session that ever wrote a handoff, with nothing pruning them. The catalog is behaving as a catalog there rather than failing, so the filter sits in the reader: `session-resume` drops the `index`, `priority`, `backlog`, and `session-` rows before calling what remains the task list. Teaching the generator to skip them was the alternative and it breaks the one thing the catalog is for, which is naming every file in the folder.

Every sibling added to the folder has to reach that reader, which is the cost of putting the filter there. `backlog.md` shows the cost: the catalog lists it like any other file, so a reader filtering only three names counts the second board surface as a task.

### The recoveries

The handoff carries the second recovery, since the body is what a compaction takes and the map is what survives it. Its closing block names the resume invocation and the review poll that resume does not restart, and the runbook states the duplication as deliberate so a later pass does not read it as a copy to collapse. Both runbook paths are resolved to absolute form as the file is written, for the reason `canon/context/claude-internal/orchestration/review.md` records about the poll prompt.

`session-resume` reads the newest map ahead of the board and reports it under a `Carried over` slot, which closes the loop for every session that holds no orchestrating role. It reads and never writes, since the write happens at the close of a session and the read at its start, and it names the standard when a session asks how to leave a handoff behind rather than routing that request to a skill of its own. Absence stays silent, because most projects carry no map and a line reporting that every run trains a reader to skip the line on the run where one exists.

Capture sits in the handoff rather than in the sweep because a pass per batch of merges bills the operator a wait while nothing is being built. The sweep reports the debt in its output block and the handoff pays it, which keeps the signal without the wait.

## The parked-row pass

The parked-row pass stays a separate runbook and the sweep ends by firing it. The two ask opposite questions, since all three refill triggers ask what to promote next and take the blocker cell as read, while the pass asks whether the cell is still true. A merge changes the tree under every parked row at once rather than under the rows naming it, which is what forces the merge trigger, and an idle trigger alone never fires the pass through a busy day of sweeps.

Folding the pass into the sweep was the alternative and it loses the idle-session trigger, which is the window where planning what the pass clears costs the critical path nothing. Two triggers into one runbook keeps both, and they differ in scope rather than in procedure: a merge sends the rows `canon tasks validate` listed as untested, and an idle session walks every parked row because no event narrowed which to look at.

The runbook carries the two ways a re-test returns a confident wrong answer rather than an error: reading the condition looser than the code consuming it defines the shape, and measuring it against a tree the shipped command does not run against.

The pass carries a second scope rather than a second runbook, walking `backlog.md` on the same idle trigger. A backlog row carries no blocker cell, so the walk applies a different test than a board row gets, reading `standards/board.md`'s own board-or-backlog call off the task file's `## Findings` and its origin line rather than porting the five blocker kinds onto a surface that carries none of them. The two directions of that call stay split: the runbook performs the promotion direction as a full walk over the backlog, and the refill-sweep sub-bullet in `orchestrator-refill.md` keeps only the demotion direction, a row that stopped being near-term moving to `backlog.md`, rather than restating a walk the runbook owns.

## Gotchas

### The expansion trial's citations

The expansion-route rule `orchestrator-launch.md` states without a number are grounded in a trial rather than asserted from reasoning alone. The dispatch-to-address-a-review case is narrated in full under the channel section of `canon/context/claude-plugin/skill-review/worker.md`.
