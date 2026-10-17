---
title: Runbooks
description: The orchestrator runbooks under role-orchestrator, the session map a compaction writes and resume reads, and the parked-row pass the sweep fires
---

# Runbooks

## Layout

### The runbook set

Runbooks under `claude/skills/role-orchestrator/references/` cover the moments the model cannot detect on its own, beside the refill, handback, review dispatch, and output shapes the body moved out to stay under the length ceiling.

| Runbook                                                                                 | Holds                                                           | Covered in    |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------- |
| `orchestrator-sweep.md`                                                                 | The queue refill after a batch of merges                        | this file     |
| `orchestrator-parked.md`                                                                | The re-test of a row already parked, on the opposite trigger    | this file     |
| `orchestrator-poll.md`, `orchestrator-watch.md`                                         | The review trigger, the roster watch and its stall alarm        | `review.md`   |
| `orchestrator-dispatch.md`, `orchestrator-launch.md`, `orchestrator-reviewer-launch.md` | The self-dispatch checks, launch templates, and reviewer shapes | `dispatch.md` |
| `orchestrator-inbound.md`                                                               | The cost a wide wave puts on this session                       | `dispatch.md` |
| `orchestrator-handoff.md`, `orchestrator-resume.md`                                     | The two sides of a compaction                                   | this file     |

### Why they ship inside the skill

A runbook the skill cites has to resolve for a project holding the plugin and running no install. The human fires the two compaction sides by asking for them once the skill is loaded.

The routing lives in the body and the skill is user-invoked, so a long session that has dropped the body routes nothing. The body therefore names re-invocation and the two runbook paths as one recovery.

## Decisions

### The session map

`orchestrator-handoff.md` covers the write side of a compaction and `orchestrator-resume.md` the read side, both over the session map `claude/skills/session-map/references/session.md` governs. The standard holds what any session can fill, and the `session-map` skill is the invocable route onto it.

- The standard holds the three core sections, the per-session filename, the capture and drift steps that open the write, and the citation rule
- A plain session about to compact takes `session-compact`, which writes under `.canon/compact/` and leaves the board alone
- The `PreCompact` hook names that skill and points this role at its own runbook

### What the role adds

The runbook holds three things over the `session-map` call, all settled before the door writes, since the door reports the map as written and knows nothing of the role.

- The section for decisions taken under delegated authority
- The closing block that restarts the review poll
- The caveat that this session never commits, which the door passes to capture so no fact routes into a tracked file

A fourth act settles first and puts nothing in the map. The runbook retires the sessions this wave delivered, per `canon/context/claude-internal/orchestration/reclaim.md`, ahead of the write because a session retired after it is one the map already listed as running.

### Split by role

Splitting on role rather than file is what lets a feature session write a handoff at all. A worker holds no delegation to have exercised and runs no review poll, so lifting the whole runbook would hand it two sections it can only leave blank, and a blank section teaches its reader to skip the file.

The drift step sits in the standard on the opposite test. The failure it detects follows session length rather than role, so a long worker session following a body the repository has moved past is the case it exists for.

- The reference sits in `session-map`, the one skill that writes the file
- `role-orchestrator` and `session-resume` read it as siblings through `${CLAUDE_SKILL_DIR}/../session-map/references/session.md`, which resolves in the plugin cache as `../markdown-craft/` does

### One file per session

One file per session keeps two writers off one path. `session-<slug>.md` takes the branch-derived slug, so two sessions closing near each other write different files and the reader takes the newest by modification time.

- A declared section ownership over one file lost, since it asks two sessions to cooperate on a write neither can watch the other make
- The cost is a folder to scan rather than a known path, which the newest-wins read absorbs
- `RESERVED_STEMS` in `src/tasks/archive.ts` carries the prefix so neither task verb counts a handoff as a task with no row

### The catalog filter lives in the reader

The board catalog filters nothing and gains a row per session that ever wrote a handoff, with nothing pruning them. That is the catalog behaving as a catalog, so the filter sits in the reader. `session-resume` drops the `index`, `priority`, `backlog`, and `session-` rows before calling what remains the task list.

Teaching the generator to skip them would break the one thing the catalog is for, naming every file in the folder. The cost is that every sibling added to the folder has to reach that reader. `backlog.md` shows it, since a reader filtering only three names counts the second board surface as a task.

### The recoveries

The handoff carries the second recovery, since the body is what a compaction takes and the map is what survives it. Its closing block names the resume invocation and the review poll that resume does not restart. The runbook states the duplication as deliberate so a later pass does not collapse it.

Both runbook paths are resolved to absolute form as the file is written, for the reason `canon/context/claude-internal/orchestration/review.md` records about the poll prompt.

### How resume reads the map

`session-resume` reads the newest map ahead of the board and reports it under a `Carried over` slot, which closes the loop for every session without an orchestrating role.

- It reads and never writes, since the write happens at the close of a session and the read at its start
- It names the standard when asked how to leave a handoff behind, rather than routing to a skill of its own
- Absence stays silent, since most projects carry no map and a line reporting that every run trains a reader to skip it

### Where capture sits

Capture sits in the handoff rather than the sweep, because a pass per batch of merges bills the operator a wait while nothing is being built. The sweep reports the debt in its output block and the handoff pays it.

### The parked-row pass

The parked-row pass stays a separate runbook and the sweep ends by firing it. The two ask opposite questions. The three refill triggers ask what to promote next and take the blocker cell as read, where the pass asks whether the cell is still true.

A merge changes the tree under every parked row at once, not only the rows naming it, which forces the merge trigger. An idle trigger alone never fires the pass through a busy day of sweeps.

### Why not fold the pass into the sweep

Folding it in loses the idle-session trigger, the window where planning what the pass clears costs the critical path nothing. Two triggers into one runbook keeps both, and they differ in scope rather than procedure.

- A merge sends the rows `canon tasks validate` listed as untested
- An idle session walks every parked row, since no event narrowed which to look at
- The runbook carries two ways a re-test returns a confident wrong answer
- One reads the condition looser than the code consuming it defines it. The other measures against a tree the shipped command does not run against.

### The backlog scope

The pass walks `backlog.md` on the same idle trigger as a second scope rather than a second runbook. A backlog row carries no blocker cell, so the walk reads the board-or-backlog call in `claude/skills/task-board/references/board.md` off the task file's `## Findings` and origin line, not the five blocker kinds.

The two directions of that call stay split. The runbook performs promotion as a full walk over the backlog, and the refill-sweep sub-bullet in `orchestrator-refill.md` keeps only demotion, a row that stopped being near-term moving to `backlog.md`.

## Gotchas

### The expansion trial's citations

The expansion-route rules `orchestrator-launch.md` states without a number are grounded in a trial rather than reasoning alone. The dispatch-to-address-a-review case is narrated in full under the channel section of `canon/context/claude-plugin/skill-review/worker.md`.
