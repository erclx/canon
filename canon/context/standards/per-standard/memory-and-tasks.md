---
title: Memory and tasks
description: Where the memory standard's delete prohibition lives and why, the shape rules measured against the pen, why the review queue is its own verb reading cited paths, the tasks readiness test widened to admit a row waiting on an external condition, the board standard split from tasks, and the origin and archiving rationale
---

# Memory and tasks

## Memory standard

`standards/memory.md` fixes the filename and its type prefix, the frontmatter, the body shape each type carries, links between entries, and the lifecycle.

`governance/rules/canon/603-memory.md` loads every session and carries three bullets rather than pointing at the standard for everything: the write location, because `.canon/memory/` rather than `~/.claude/projects/` is project policy, the routing rule, because it has to fire before an entry is written at all, and the delete prohibition.

The delete prohibition sits in the always-loaded rule on purpose. A path-scoped rule fires when a session edits a file the glob matches, and a bulk retire runs through the shell as a `mv`, so `659-memory.md`, which globs `.canon/memory/**` and routes to the standard's lifecycle, is never loaded at the moment the irreversible act happens. `603-memory.md` is what reaches the shell path. The tier test in `canon/context/context-model.md` asks whether a rule fires on a path being edited, and this is the case where the answer is no because the violating action is not an edit.

## Memory pen shape

The shape rules are measured against the pen rather than drafted from the sources. Every body opens with a prose rule line, no marker is ever indented, and `**Why:**` and `**How to apply:**` co-occur in every rule-bearing entry, and the entries carrying neither are exactly the `reference` and `user` types.

Blank lines between the three parts vary across the pen, so the standard states the three parts as the contract and stays silent on the separator. Requiring one spelling would report a large share of the corpus on the rule readers are least served by.

`category` is compared against the sentence-case form of the filename prefix rather than checked field by field. One comparison catches a prefix outside the four types, a field disagreeing with the prefix, and a casing drift that would open a second group in the generated catalog, and it reports one finding where three rules would report the same defect three times.

No dangling-link check ships. A `[[name]]` link that resolves to nothing usually names an entry not yet written, which the format treats as a marker worth keeping, and some apparent dangles are backticked TOML `[[table]]` syntax.

The two classes the verb catches are an entry titled with its own filename stem, which renders a slug in the catalog where the rule belongs, and a filename prefix belonging to none of the four types.

## Review queue

Staleness is its own verb, `canon records stale memory`, rather than a class on `validate`. `memory-capture` runs `validate memory` on every ship and fixes every finding it names, so a class reporting every never-reviewed entry would turn each capture into a partial review of the whole pen. The two also answer different questions, one whether a file matches its standard and the other what a review should look at next, and a flag switching `validate` between them would make its exit code mean two things.

Path resolution is the proxy for an entry the tree has moved under. A backticked path resolving to nothing is a cheap signal that the fact was written about a layout since renamed, and the first reading at `12b2d338` found 42 of 361 entries citing one, most of them the retired `.claude/context/` and `.claude/*.md` roots. It misses an entry whose rule the tree now contradicts in prose, which stays the review's judgment, and it flags a toolkit path cited from a target's pen, which is correct for that target and still a thing for the review to judge rather than retire on.

The optional `reviewed` date is what makes review state durable. An entry without it reads as never reviewed, which is every entry at introduction, so the field adds no finding to `validate` and costs the pen nothing until a review writes it.

## Tasks readiness test

`standards/board.md` admits a row to `## Up next` on a written plan plus a stated reason the task cannot start, and that group's `Waiting on` cell carries a collision, a sibling task, or an external condition. The three forms are stated under the group they govern rather than under the header they share. A test naming only the first two leaves a planned task waiting on a condition outside the board passing neither it nor the `## Needs a plan` test below it.

A fourth heading lost, and the standard bans one, because a board grouped under names of its own reads as empty to anything counting rows under a heading. Widening a test costs one clause and keeps the three headings every reader already parses.

The three tests are read in order, so widening `## Up next` alone leaves its new kind unreachable. A `## Run now` test whose second half names only a file collision admits a task blocked on an external condition, since such a task collides with nothing running. Both tests therefore turn on the same clause, that the task carries no reason it cannot start, with the collision kept named under `## Run now` so the `Touches` column and the validator's collision check keep their basis.

The external kind names what would satisfy the condition rather than the condition alone. Without that clause the kind admits any excuse, including a row nobody has looked at.

The `## Needs a plan` cell takes the same treatment. It states why the row sits where it does, never why the row matters, since a reason of that shape admits every row at once and leaves the order to whenever each was filed. Naming the row or the class it is ranked against is what a comparison costs. `canon tasks validate` reads it back, and the mechanism sits in `canon/context/cli/audits/board.md`.

`canon tasks validate` resolves the `Task`, `Plan`, and `Touches` columns by header text and never reads the `Waiting on` cell, so the widened test holds on reading alone and the standard says so. A non-empty check lost, since every row already passes it. Every finding the validator reports compares a written claim against the tree, and an external condition puts no fact there to disagree with.

## Board split from tasks

`standards/board.md` carries `priority.md`, `backlog.md`, and the generated index, and `standards/tasks.md` keeps the task file. The two govern different documents with their own templates, and cutting the ordering and backlog rules down inside one file would have cut live rules to fit the length ceiling. `655-tasks.md` globs the whole folder, so it routes to both.

## Tasks origin and archiving

An intake folder is read for abandonment at folder scope, since one dump dispositions many items and most close without becoming a task. The check counts the archive and the declined folder beside the board, because a check reading the board alone calls every finished folder abandoned.

The `Pull request:` line is what lets a merge close its task. Every merge on `main` is a squash carrying the number in its subject, so the number survives where a branch name does not. `canon tasks archive --pull-request <n>` archives only on the last listed number, since outcomes are ticked at ship time and an earlier slice can merge after the last one shipped.

The last listed number is not yet the last slice while a branch has ticked an outcome and `git-pr` has not recorded its number, so `canon tasks outcome` run from a feature branch writes a `Pending branch:` line and the merge-time archive refuses `pending-branch` until `canon tasks pull-request` clears it. Reordering `git-ship` so `git-pr` runs before `context-fold` was the alternative, and it lost because an early tick outside the chain skips any ordering. The marker is keyed on a branch name, and `git-ship` can rename a branch after the tick, so the clear also takes every name the branch's reflog records it renamed from. A stem archive ignores the marker, which is the route out for an abandoned branch.

Without the line the board can only be swept blind, and a blind sweep cannot tell a shipped task from an abandoned one. `git-pr` writes it because opening a pull request is the one step that runs whether the chain drives it or a person does.

The task archive nests inside `.canon/tasks/` under one fixed destination, which lets the move happen without asking. It mirrors `.canon/plans/archive/` and inherits the board's own ignore entry, at the cost that an archived task never appears in a diff, which the live board already pays.

`canon tasks decline` carries no outcome-state gate, which keeps its refusal set disjoint from archive's. A shared gate would let one verb archive a task that cannot yet ship or decline one that already has.

The citation count before a plan archives guards against the one-plan-per-task misfile stranding a pointer. It is not support for a plan shared by design.

## The tasks rule keeps the plan-writing act

`governance/rules/canon/602-tasks.md` keeps the act of writing a plan in the same session as its task and linking it, because the standard fixes the `Plan:` link for a plan that exists and never tells a session to create one. The seed eval in `scripts/eval/result-seed.md` measured the gap: sessions holding the bullet wrote plans and sessions without it wrote none.
