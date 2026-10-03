---
title: Task decline reference
description: Where a task decided against moves, the Declined line it carries, and what happens to its plan and board row
---

# Task decline reference

Applies to a task under `.canon/tasks/` that somebody decided against doing. `canon tasks decline` performs the move, and this file fixes what the move leaves behind.

This is an attribute standard. It governs one origin line and one folder move rather than a file of its own, so it carries no template.

## Scope

Governs the `.canon/tasks/declined/` folder, the `Declined:` line, and what declining does to the task's plan and board row.

Does not govern:

- The task file's layout, filename, format, other origin lines, and archiving: `tasks.md`
- The board rows the move clears: `board.md`

## What a working decline looks like

A declined task works when a later reader can tell, from the folder and the file alone:

- Was the work decided against, rather than shipped or merely unscheduled?
- Who decided, when, and why?

## Declining

A task decided against moves to `.canon/tasks/declined/` rather than `.canon/tasks/archive/`. The two folders answer different questions: archive means the work shipped, declined means somebody decided against doing it. Neither reading fits a task that is merely unscheduled, which stays on `backlog.md` rather than moving anywhere, since nobody has decided against it and it may still rise when the board has room.

`canon tasks decline` carries no outcome-state gate, so a task can be decided against at any outcome state, open outcomes included.

The decision is recorded on the task itself with a `Declined:` line, in the `Plan:`/`Pull request:` family: `Declined: <reason>, <who> on <YYYY-MM-DD>`. It anchors the same way `Pull request:` does, after the last origin line the task carries. The line is free prose after the colon, since it names no file to link.

Declining a task moves its plan alongside it the same way archiving does, when the declining task is that plan's last live citation. A plan several tasks share stays where it is, and a declined task's plan lands in `.canon/plans/archive/` indistinguishable from a shipped one by folder alone. The task file under `.canon/tasks/declined/` is what records which it was.

The move clears whichever of `priority.md` or `backlog.md` holds the task's row.
