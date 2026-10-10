---
title: Tasks
description: The tasks readiness test widened to admit a row waiting on an external condition, the board standard split from tasks, and the origin and archiving rationale
---

# Tasks

## Tasks readiness test

`claude/skills/task-board/references/board.md` admits a row to `## Up next` on a written plan plus a stated reason the task cannot start, and that group's `Waiting on` cell carries a collision, a sibling task, or an external condition. The three forms are stated under the group they govern rather than under the header they share. A test naming only the first two leaves a planned task waiting on a condition outside the board passing neither it nor the `## Needs a plan` test below it.

A fourth heading lost, and the standard bans one, because a board grouped under names of its own reads as empty to anything counting rows under a heading. Widening a test costs one clause and keeps the three headings every reader already parses.

The three tests are read in order, so widening `## Up next` alone leaves its new kind unreachable. A `## Run now` test whose second half names only a file collision admits a task blocked on an external condition, since such a task collides with nothing running. Both tests therefore turn on the same clause, that the task carries no reason it cannot start, with the collision kept named under `## Run now` so the `Touches` column keeps its basis.

The collision named there is one no merge settles, being a contract, a relocation, or a sweep. A shared file alone stopped counting once the dispatch gate stopped holding on one, so the validator lists it in a `shared` array rather than failing the board.

The external kind names what would satisfy the condition rather than the condition alone. Without that clause the kind admits any excuse, including a row nobody has looked at.

The `## Needs a plan` cell takes the same treatment. It states why the row sits where it does, never why the row matters, since a reason of that shape admits every row at once and leaves the order to whenever each was filed. Naming the row or the class it is ranked against is what a comparison costs. `canon tasks validate` reads it back, and the mechanism sits in `canon/context/cli/audits/board.md`.

`canon tasks validate` resolves the `Task`, `Plan`, and `Touches` columns by header text and never reads the `Waiting on` cell, so the widened test holds on reading alone and the standard says so. A non-empty check lost, since every row already passes it. Every finding the validator reports compares a written claim against the tree, and an external condition puts no fact there to disagree with.

## Board split from tasks

`claude/skills/task-board/references/board.md` carries `priority.md`, `backlog.md`, and the generated index, and `claude/skills/task-board/references/tasks.md` keeps the task file. The two govern different documents with their own templates, and cutting the ordering and backlog rules down inside one file would have cut live rules to fit the length ceiling. `governance/rules/canon/tasks.md` globs the whole folder, so it routes to both.

## Tasks origin and archiving

An intake folder is read for abandonment at folder scope, since one dump dispositions many items and most close without becoming a task. The check counts the archive and the declined folder beside the board, because a check reading the board alone calls every finished folder abandoned.

The `Pull request:` line is what lets a merge close its task. Every merge on `main` is a squash carrying the number in its subject, so the number survives where a branch name does not. `canon tasks archive --pull-request <n>` archives only on the last listed number, since outcomes are ticked at ship time and an earlier slice can merge after the last one shipped.

The last listed number is not yet the last slice while a branch has ticked an outcome and `git-pr` has not recorded its number, so `canon tasks outcome` run from a feature branch writes a `Pending branch:` line and the merge-time archive refuses `pending-branch` until `canon tasks pull-request` clears it. Reordering `git-ship` so `git-pr` runs before `context-fold` was the alternative, and it lost because an early tick outside the chain skips any ordering. The marker is keyed on a branch name, and `git-ship` can rename a branch after the tick, so the clear also takes every name the branch's reflog records it renamed from. `canon tasks outcome` skips the write when `gh pr list --head <branch>` lists a number already on the line, as in a review-address tick, and a failed lookup writes it. `canon tasks validate` reads a cited task carrying the marker as untested. A stem archive ignores the marker, which is the route out for an abandoned branch.

Without the line the board can only be swept blind, and a blind sweep cannot tell a shipped task from an abandoned one. `git-pr` writes it because opening a pull request is the one step that runs whether the chain drives it or a person does.

The task archive nests inside `.canon/tasks/` under one fixed destination, which lets the move happen without asking. It mirrors `.canon/plans/archive/` and inherits the board's own ignore entry, at the cost that an archived task never appears in a diff, which the live board already pays.

`canon tasks decline` carries no outcome-state gate, which keeps its refusal set disjoint from archive's. A shared gate would let one verb archive a task that cannot yet ship or decline one that already has.

The citation count before a plan archives guards against the one-plan-per-task misfile stranding a pointer. It is not support for a plan shared by design.

## The tasks rule keeps the plan-writing act

`governance/rules/canon/602-tasks.md` keeps the act of writing a plan in the same session as its task and linking it, because the standard fixes the `Plan:` link for a plan that exists and never tells a session to create one. The seed eval in `scripts/eval/result-seed.md` measured the gap: sessions holding the bullet wrote plans and sessions without it wrote none.
