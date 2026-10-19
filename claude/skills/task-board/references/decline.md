---
title: Decline a task
description: How task-board gathers the reason a task is decided against, runs canon tasks decline, routes each refusal, and clears prose naming the declined task
---

# Decline a task

The Decline mode of `task-board`. The session reads this file when the request names a task decided against.

- Read `${CLAUDE_SKILL_DIR}/references/tasks-decline.md` first, for the declined folder, the `Declined:` line, and what the move does to a plan and a board row
- A declined task carries no `post-merge` hook of its own, so every decline request arrives here directly
- `canon tasks decline` moves the file, edits `priority.md` or `backlog.md`, and regenerates the index as one unit. Do none of the three by hand.

## Step 1: gather the reason

Ask for the reason when the request carries none, and stop rather than guessing with `❌ No reason. Say why the task is being declined.` The command refuses without `--reason <text>`, so asking first saves the round trip.

## Step 2: run the decline

Pass the task's filename stem:

```bash
canon tasks decline <stem> --reason "<text>" [--by <name>] --json
```

Branch on the record's `ok`, then on `reason`, never on the exit. A shell wrapper can flatten the exit, the same hazard `canon tasks archive` carries.

### Success record

A successful decline returns one record whose fields match `canon tasks archive` where the two overlap.

| Field                | Holds                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| `from`, `to`         | The task's old and new path                                              |
| `priorityRowRemoved` | Whether a `priority.md` row was dropped                                  |
| `backlogRowRemoved`  | Whether a `backlog.md` row was dropped                                   |
| `indexRegenerated`   | Whether the index was rewritten                                          |
| `plans`              | A `from` and `to` per live plan the task last cited, empty if none moved |

A task can be declined straight off `backlog.md`, so decline checks that file as well as `priority.md`. Archive does the same and reports the same two fields.

## Step 3: route on a refusal

Each refusal names its cause and the fix.

| `reason`    | Cause                                                                | Fix                                        |
| ----------- | -------------------------------------------------------------------- | ------------------------------------------ |
| `no-match`  | No task matches, or one starts with the stem and needs its full name | Check against the listed stems             |
| `ambiguous` | The stem is a prefix of more than one task                           | Pass the full stem                         |
| `bad-input` | The command line was wrong rather than the board                     | Read the message, fix the arguments, rerun |

Archive's own `ambiguous` fires on a shared pull request instead, and decline takes no pull-request selector. A `bad-input` leaves nothing on the board to repair, which separates it from the other two.

Never move a plan by hand from this skill. The command carries the plan along when no other live task cites it and retargets the `Plan:` line, and a second mover relocates the same file differently.

## Step 4: clear prose naming the task

The command drops the row from `.canon/tasks/priority.md` or `.canon/tasks/backlog.md` and leaves prose alone. Remove any sentence that still names the declined task or counts the changed rows, since a stale count reads as board state.
