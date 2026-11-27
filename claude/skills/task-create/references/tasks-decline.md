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

A task decided against moves to `.canon/tasks/declined/` rather than `.canon/tasks/archive/`. Archive means the work shipped, and declined means somebody decided against doing it.

- A merely unscheduled task fits neither. It stays on `backlog.md`, since nobody decided against it and it may still rise.
- `canon tasks decline` carries no outcome-state gate, so a task can be declined at any outcome state, open outcomes included
- The move clears whichever of `priority.md` or `backlog.md` holds the task's row

### The `Declined:` line

The decision is recorded on the task with a `Declined:` line in the `Plan:` and `Pull request:` family, as `Declined: <reason>, <who> on <YYYY-MM-DD>`. It anchors after the last origin line the task carries, as `Pull request:` does, and stays free prose since it names no file to link.

### The plan

Declining moves the plan alongside the task when the task is that plan's last live citation, as archiving does. A plan several tasks share stays where it is.

- A declined task's plan lands in `.canon/plans/archive/`, indistinguishable from a shipped one by folder alone
- The task file under `.canon/tasks/declined/` records which it was
