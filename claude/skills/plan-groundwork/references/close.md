---
title: Groundwork close routes
description: The route close Step 4 takes to record a track's conclusion, read from the origin record, and how close Step 7 plans that conclusion in the closing session or names the handoff
---

# Groundwork close routes

Applies to close mode Steps 4 and 7 of `plan-groundwork`. Read it on reaching Step 4, since Step 7 keys on the route Step 4 took.

## Close routes

Read the route from the origin record in `README.md`, never from the launch string, which a compaction drops. A launch names a controller only by a `Controller: <sessionId>` line. A roster name prefix is no test, since a controller can carry any name.

| Launch named             | Step 4 does                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| A task                   | Writes the conclusion into that task as a `Groundwork:` origin line and a finding, and creates no second file |
| A controller and no task | Writes no task file and claims no label, and hands the conclusion to the controller, which places the row     |
| Neither                  | Writes one task file in `.canon/tasks/` and places its row through `task-board` Step 4                        |

The handoff rides the close announcement `role-planner` already owes, as one message, since a second one is a second thing the controller reconciles. It carries the track path, the decision in one line, and the origin lines a task file would open with.

A track opened from an intake item cites the item for the verdict rather than restating it. Its origin lines carry `Intake:` with the item number beside `Groundwork:`, on the handoff and in a new task file alike, so the row files from the item's bundle. A new task file takes the shape `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md` fixes.

## Planning the conclusion

The session that measured holds the evidence, so it plans the row by default rather than leaving a cold planner to re-read the same code. Skip this step when the conclusion is to do nothing, and hand off instead when the bar `role-planner` states under `### Planning what this session measured` holds.

| Step 4 route             | Step 7 does                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| A task                   | Invokes `canon:plan-feature` on that task                                                      |
| A controller and no task | Says in the close announcement that this session is planning, and waits for the row named back |
| Neither                  | Invokes `canon:plan-feature` on the task file Step 4 wrote                                     |

Under a controller, plan only the row it names back, invoke `canon:plan-feature` on it, and write no task file. The close announcement says one of two things, that this session is planning or that it hands off and why, so the controller never launches a second planner beside this one.

- A launch that already chains `plan-feature` after the close runs it once, here
- An item Step 5 routed through `plan-intake` is planned only once its `You:` slot is answered and its row is named back
- Each plan is written under `plan-feature`'s own write scope, which the rule above does not reach
