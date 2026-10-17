---
title: Tasks
description: The readiness test widened for external conditions, the board split from tasks, and why a merge closes a task and the archive moves unasked
---

# Tasks

## Overview

The tasks and board references carry a readiness test that has to admit a row no fact on disk can confirm, and a board split that keeps each reference under the length ceiling. This entry also records why a merge can close a task and why the archive moves without asking.

## Layout

- `claude/skills/task-board/references/` owns the task and board references these decisions explain
- `src/tasks/` owns the board validator and the archive verbs that read both references back

## Decisions

### Tasks readiness test

`claude/skills/task-board/references/board.md` admits a row to `## Up next` on a written plan plus a stated reason the task cannot start. The `Waiting on` cell carries a collision, a sibling task, or an external condition, each stated under the group it governs.

A test naming only the first two leaves a planned task waiting on an outside condition passing neither it nor the `## Needs a plan` test below it.

- A fourth heading lost, and the standard bans one, because a board grouped under names of its own reads as empty to anything counting rows under a heading
- Widening a test costs one clause and keeps the three headings every reader already parses

### Widening the run-now test too

The three tests are read in order, so widening `## Up next` alone leaves its new kind unreachable. A `## Run now` test whose second half names only a file collision admits a task blocked on an external condition, since such a task collides with nothing running.

Both tests therefore turn on one clause, that the task carries no reason it cannot start. The collision stays named under `## Run now` so the `Touches` column keeps its basis.

### Waiting-on cells

Each cell form states a reason a check can read, so none admits every row.

- The collision named under `## Run now` is one no merge settles, being a contract, a relocation, or a sweep
- A shared file alone stopped counting once the dispatch gate stopped holding on one, so the validator lists it in a `shared` array rather than failing the board
- The external kind names what would satisfy the condition, because without that clause it admits any excuse, including a row nobody has looked at
- The `## Needs a plan` cell states why the row sits where it does, never why it matters, since a reason of that shape admits every row
- Naming the row or the class it is ranked against is what a comparison costs

`canon tasks validate` resolves the `Task`, `Plan`, and `Touches` columns by header text and never reads the `Waiting on` cell, so the widened test holds on reading alone. A non-empty check lost, since every row already passes it.

Every validator finding compares a written claim against the tree, and an external condition puts no fact there to disagree with. The mechanism sits in `canon/context/cli/audits/board.md`.

### Board split from tasks

`claude/skills/task-board/references/board.md` carries `priority.md`, `backlog.md`, and the generated index. `claude/skills/task-board/references/tasks.md` keeps the task file.

- The two govern different documents with their own templates, and trimming the ordering and backlog rules inside one file would have cut live rules to fit the length ceiling
- `governance/rules/canon/tasks.md` globs the whole folder, so it routes to both

### Origin and archiving

An intake folder is read for abandonment at folder scope, since one dump dispositions many items and most close without becoming a task. The check counts the archive and the declined folder beside the board, because a check reading the board alone calls every finished folder abandoned.

The `Pull request:` line is what lets a merge close its task. Every merge on `main` is a squash carrying the number in its subject, so the number survives where a branch name does not.

- Without the line the board can only be swept blind, which cannot tell a shipped task from an abandoned one
- `git-pr` writes it because opening a pull request is the one step that runs whether the chain drives it or a person does
- `canon tasks archive --pull-request <n>` archives only on the last listed number, since outcomes are ticked at ship time and an earlier slice can merge after the last one shipped

### The pending-branch marker

The last listed number is not yet the last slice while a branch has ticked an outcome and `git-pr` has not recorded its number. So `canon tasks outcome` run from a feature branch writes a `Pending branch:` line, and the merge-time archive refuses `pending-branch` until `canon tasks pull-request` clears it.

- Reordering `git-ship` so `git-pr` runs before `task-complete` lost, because an early tick outside the chain skips any ordering
- The marker is keyed on a branch name and `git-ship` can rename a branch after the tick, so the clear also takes every name the branch's reflog records it renamed from
- `canon tasks outcome` skips the write when `gh pr list --head <branch>` lists a number already on the line, and a failed lookup writes it
- `canon tasks validate` reads a cited task carrying the marker as untested
- A stem archive ignores the marker, which is the route out for an abandoned branch

### Archive placement and decline

The task archive nests inside `.canon/tasks/` under one fixed destination, which lets the move happen without asking. It mirrors `.canon/plans/archive/` and inherits the board's ignore entry, at the cost that an archived task never appears in a diff, which the live board already pays.

- `canon tasks decline` carries no outcome-state gate, so its refusals stay disjoint from archive's. A shared gate would let one verb archive an unshippable task or decline a shipped one.
- The citation count before a plan archives guards against the one-plan-per-task misfile stranding a pointer, and is no support for a plan shared by design

### The tasks rule keeps the plan-writing act

`governance/rules/canon/task-scope.md` keeps the act of writing a plan in the same session as its task and linking it. The standard fixes the `Plan:` link for a plan that exists and never tells a session to create one.

The seed eval in `scripts/eval/result-seed.md` measured the gap. Sessions holding the bullet wrote plans and sessions without it wrote none.

### Findings keep a bold source label

A task's `## Findings` stays a flat bullet list, each bullet opening with a bold label naming its source and date and held to a few sentences. Across 973 tasks with findings the median carried 6 and over half carried more than 5, so a plain list reads as a wall.

- An H3 per finding was rejected, since it puts about 48 headings on the longest task and makes each of the seven writing skills invent a title
- The bold label makes the list scannable by source and falls under the labeled-run exemption to the bullet cap, at one line per writing skill
- Outcomes stay a checklist because the archive verb reads them by their `- [ ]` line
