---
title: Decline a task
description: How task-board gathers the reason a task is decided against, runs canon tasks decline, routes each refusal, and clears prose naming the declined task
---

# Decline a task

The Decline mode of `task-board`. The session reads this file when the request names a task decided against.

A task decided against carries no `post-merge` hook of its own, so every decline request arrives here directly rather than through work the hook already did.

Do not move the file, edit `priority.md` or `backlog.md`, or regenerate the index by hand. `canon tasks decline` owns all three as one unit.

## Step 1: gather the reason

Ask for the reason when the request does not carry one, and stop rather than guessing: `❌ No reason. Say why the task is being declined.` The command takes it as `--reason <text>` and refuses without it, so gathering it here saves a round trip through that refusal.

## Step 2: run the decline

Pass the task's filename stem:

```bash
canon tasks decline <stem> --reason "<text>" [--by <name>] --json
```

The command refuses rather than reports, and the refusal reaches this skill through the record rather than through the exit, the same wrapper hazard `canon tasks archive` carries. Branch on `ok`, then on `reason`.

On success the record carries `from`, `to`, `priorityRowRemoved`, `backlogRowRemoved`, and `indexRegenerated`, where `backlogRowRemoved` is decline's own field since a task can be declined straight off `backlog.md` and archive never checks that file. It also carries `plan` when the task was the last live citation of a live plan, holding the `from` and `to` of the plan moved alongside it, the same shape `canon tasks archive` uses for its own `plan` field.

## Step 3: route on a refusal

- `no-match`: the stem does not name exactly one task. Either none matches, or exactly one starts with it and the full name is needed. Check the name against the listed stems.
- `ambiguous`: the stem is a prefix more than one task starts with, unlike archive's own `ambiguous`, which fires on a shared pull request. Decline takes no pull-request selector, so this is the only route to it. Pass the full stem.
- `bad-input`: the command line was wrong rather than the board. Read the message, fix the arguments, and run it again. Nothing on the board needs repair, which is what separates this from the two above.

Do not move a plan by hand from this skill. The command carries the plan with the task when no other live task cites it, and retargets the declined task's `Plan:` line at the new path. A second mover drifts into relocating the same file differently.

## Step 4: clear prose naming the task

The command drops the task's row from `.canon/tasks/priority.md` or `.canon/tasks/backlog.md` and leaves prose alone. Remove any sentence that still names the declined task or counts the rows that changed, since a stale count reads as board state.
