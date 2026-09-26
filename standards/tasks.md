---
title: Tasks reference
description: Folder layout, filename convention, file format, origin lines, and archiving for task files under .canon/tasks/
---

# Tasks reference

Applies to `.canon/tasks/`. Tracks what is being built and why, at the level of features and outcomes. One file per task.

Update when a task starts, completes, or changes scope. When to open a task at all is project policy, not a shape rule, and lives in `CLAUDE.md`.

The folder is gitignored. Board state changes when work ships rather than when a branch is written, so committing it would put a claim about the future into the diff of an unrelated pull request. The git log records what shipped.

## Scope

Governs the task files under `.canon/tasks/`: folder layout, filenames, frontmatter, file format, origin lines, archiving, and declining.

Does not govern:

- Execution order, readiness groups, the backlog, and the generated index beside the tasks: `board.md`
- The plan file a task cites, its sections, and its answer contract: `plan.md`
- Phase-label format and which surfaces a label may appear on: `versioning.md`
- Architectural reasoning that outlives a task: `architecture.md`
- The pre-compaction handoff sitting in the folder, its filename and its sections: `session.md`
- When a project opens a task at all, which is project policy rather than a shape rule

## Layout

```plaintext
.canon/tasks/
├── index.md              ← generated, never hand-edited
├── priority.md           ← hand-maintained execution order
├── backlog.md            ← unordered, what is not being scheduled
├── session-<slug>.md     ← optional, what a compaction is about to destroy
├── archive/              ← shipped tasks, moved by canon tasks archive
├── declined/             ← decided-against tasks, moved by canon tasks decline
├── v09.0-sync-paths.md      # canon-allow-reference: illustrates the vXX.Y-slug filename this section defines
└── v13.0-toolkit-drift.md   # canon-allow-reference: illustrates the vXX.Y-slug filename this section defines
```

One file per task is what keeps the board safe under parallel sessions. Two sessions working different tasks never write the same file, which matters because a gitignored board has no history to recover a clobbered write from.

Siblings sit in the folder without being tasks, and each earns its place by being governed somewhere. `index.md`, `priority.md`, and `backlog.md` are governed by `board.md`. Every `session-` file is a pre-compaction handoff governed by `session.md`, and each is optional: a project whose sessions never approach a compaction carries none. Anything filtering the folder to tasks skips all of them, so a name outside the set is a task whatever it holds.

The `task-board` skill creates and archives task files, and the archive carries the task's plan with it. `context-fold` marks outcomes `[x]` in an existing file. Neither does the other's job.

## Filenames

`vXX.Y-<slug>.md`, where the version is the phase label zero-padded to two digits and the slug is kebab-case.

Padding is load-bearing. Index entries sort by filename and nothing else, so a bare `v9.0` sorts after `v15.0` and the catalog reads out of board order. `standards/versioning.md` governs the label itself and permits free renumbering, so expect the occasional rename. Nothing points at a task filename, since a `Plan:` line runs from task to plan rather than the reverse. <!-- canon-allow-reference: illustrates the padding rule's own sort collision, not a citation of a real task -->

## Frontmatter

Every task file carries both fields. The index walker fails the whole folder when one is missing, which surfaces the gap on the next edit.

```yaml
---
title: 'v13.0: Detect and close toolkit drift in target projects' # canon-allow-reference: illustrates the quoted title shape, not a citation of a real task
description: Record what a target installed and report the delta against the toolkit
---
```

- `title`: the phase label and the task title, matching the H1. Quote it, since a leading `vX.Y:` reads as a key to a YAML parser.
- `description`: what the task achieves, in one line. A session reads this in the index to decide whether to open the file.

## File format

Two headings, `## Outcomes` and `## Findings`. Outcomes are future and checkable, findings are past and factual, and as flat bullets at the same indent they are visually identical. A heading separates them at no cost.

Add no third heading. Status stays inline on an outcome rather than becoming an "In progress" section.

Size the outcomes so one pull request closes all of them, and split the task before handing it off rather than after. A task closes whole or not at all, so outcomes spanning two pull requests leave the board showing in-progress work no branch carries.

A sliced task is the one allowed exception: a task the operator decided to ship across several pull requests on purpose, one slice each. Its `Pull request:` line lists every slice, so the board records which merged work covered which outcomes, and it closes whole when the last slice's merge finds every outcome ticked.

Prefix the H1 with the `vX.Y:` phase label, then a short title whose form depends on the task type:

- Feature: an outcome describing what the user can now do
- Fix: a problem statement describing what is wrong
- Chore: an imperative describing what is being done

```markdown
---
title: 'vX.Y: Title'
description: One line on what this task achieves
---

# vX.Y: Title

Plan: [feature-<slug>](../plans/feature-<slug>.md)
Groundwork: [<slug>](../groundwork/<slug>/)
Intake: [<slug>](../intake/<slug>/)
Issue: #NNN
Pull request: #NNN

Why this task exists and what it depends on.

## Outcomes

- [ ] Outcome: what done looks like
- [ ] Outcome: what done looks like

## Findings

- What constrains the task, dated where it matters.

> Test strategy: <unit | component | e2e | visual | manual>, what is being verified
```

## Origin

Every task names where it came from, through a `Plan:`, `Groundwork:`, `Intake:`, or `Issue:` line under the title. Include each only when the file, folder, or issue it names exists.

A task with no origin is either lost context or work nobody decided to do. The invariant runs both ways, and the second direction is the one that bites: a groundwork track, an intake folder, or an open issue that no task points at is work already decided and on its way to being forgotten.

An intake folder answers that direction at folder scope rather than item scope. A folder with every item answered and no task citing it, live, archived, or declined, is a dump nobody acted on.

`Plan:`, `Groundwork:`, and `Intake:` name their target as a markdown link whose text is the file or folder stem, so the line resolves on a ctrl-click the way `priority.md` rows already do. Write the path relative to `.canon/tasks/`, which makes it `../plans/`, `../groundwork/`, and `../intake/`. A path written from the project root renders as a link and resolves to nothing in an editor rooted at the project. `Ready:` names the ready folder a task's plan copies from, as a link to `../ready/<nn>-<slug>/` with the trailing slash a folder carries. Include it only when the folder exists. `canon tasks archive` reads it to move the folder, and falls back to a `.canon/ready/<nn>-<slug>/` path in the plan when a task carries no line.

`Issue:` stays a bare `#NNN`, since an issue number is not a path and a full URL would write the remote into a gitignored file.

`Plan:` points at `../plans/feature-<slug>.md` while the task is open. Once the task ships and the plan is archived, it points at `../plans/archive/feature-<slug>.md`, and at `../../plans/archive/feature-<slug>.md` once the task itself is archived a folder deeper. Retarget both halves of the link rather than dropping it, so a completed task still leads to the reasoning behind it.

A project that archived plans before the folder nested under `.canon/plans/` holds closed tasks pointing at `../plans-archive/` or `../.tmp/plans-archive/`. Leave those pointers where they are, since each resolves against the files it names and a task retargeted without its plan moving leads nowhere.

One plan per task. A plan cited by two tasks is a misfile rather than a shape to design for.

`canon tasks plan-link <task> <plan>` writes or corrects the `Plan:` line, so the line is a mechanical write rather than hand-edited markdown.

`Groundwork:` points at `../groundwork/<slug>/`, the folder `plan-groundwork` fills. It names the surface it points at the way `Plan:` does. Use this key alone. `Research record` and `Decision record` are earlier spellings of the same thing and both convert to it.

`Intake:` points at `../intake/<slug>/`, the folder an intake pass fills. Use it rather than `Groundwork:`, so the line records which kind of pass produced the task. It names the folder rather than an item inside it, and the item numbers belong in that task's `## Findings`.

`Pull request:` records which pull requests carry the task's work, each as a bare `#NNN` the way `Issue:` does. It lists every pull request that shipped part of the task, oldest first and separated by commas, as in `Pull request: #NNN, #NNN`, and a task shipped whole lists one. It is not an origin, so a task without one is well-formed. `git-pr` appends to it when a pull request opens.

The line is what lets a merge close its own task. `canon tasks archive --pull-request <n>` finds the task by any number the line lists and archives it only on the last. One pull request, one task: two tasks naming the same number refuse to archive rather than both moving.

## What goes in

- Task entries describing observable behavior, one outcome per line
- A test strategy line naming the mechanism and what it verifies
- Findings stating what constrains the task, including blockers and dependencies
- A deviation from the plan's suggestion, in one line naming what moved the pick. The plan is archived at ship and holds the reasoning, so this register carries what shipped.

## What does not go in

- Class names, file paths, function names, or prop names in any entry or title
- Code-level steps or implementation detail. Behavioral specifics are fine.
- Architectural reasoning that outlives the task. A finding explains why this task is shaped as it is. A decision the system keeps after the task closes belongs in `canon/ARCHITECTURE.md`.
- Narrative of the session that produced the task. A finding states what constrains the task, so what was probed, what it cost, and who decided belongs in the groundwork folder the `Groundwork:` line names. A task with no groundwork folder cuts the narrative rather than relocating it, since the board is not the fallback destination for it.
- "In progress" or "Blocked" headings. Note status inline on the outcome instead.
- Sequencing rationale or which version is active. Why this task is planned before its neighbors goes on its row in `priority.md`, in the cell that already carries what it is waiting on. Rationale wider than one row has no home at all, so cut it rather than filing it here.

## Archiving

Never delete a task file. A shipped task moves to `.canon/tasks/archive/` under its own name, and the live index regenerates without it. `canon tasks archive` owns that move, and what it does and what it refuses on are at `canon docs tasks-archive`.

The archive nests inside `.canon/tasks/` rather than sitting beside it as a flat `.claude/task-archive/`, which is what a binary predating this convention still writes. Meeting the flat sibling names an older checkout rather than a second archive to reconcile.

Archiving a task archives its plan alongside it, when the closing task is that plan's last live citation. The archived task's `Plan:` line is retargeted at `../../plans/archive/feature-<slug>.md`. The ready folder its `Ready:` line names moves with the plan to `.canon/ready/archive/<nn>-<slug>/`, and both pointers to it are retargeted. A plan several tasks share stays live with its ready folder, and the task archives anyway.

A task with an open outcome stays on the board, and so does its plan. Close it, or cut it from the task when the work is being abandoned, so what was dropped is recorded rather than inferred from an archived file. Cutting means striking the outcome's body: `- ~~<outcome>~~ <why>`. A struck body reads as cut whatever its checkbox holds, so a task carrying only cut outcomes still archives.

## Declining

A task decided against moves to `.canon/tasks/declined/` rather than `.canon/tasks/archive/`. The two folders answer different questions: archive means the work shipped, declined means somebody decided against doing it. Neither reading fits a task that is merely unscheduled, which stays on `backlog.md` rather than moving anywhere, since nobody has decided against it and it may still rise when the board has room.

`canon tasks decline` carries no outcome-state gate, so a task can be decided against at any outcome state, open outcomes included.

The decision is recorded on the task itself with a `Declined:` line, in the `Plan:`/`Pull request:` family: `Declined: <reason>, <who> on <YYYY-MM-DD>`. It anchors the same way `Pull request:` does, after the last origin line the task carries. The line is free prose after the colon, since it names no file to link.

Declining a task moves its plan alongside it the same way archiving does, when the declining task is that plan's last live citation. A plan several tasks share stays where it is, and a declined task's plan lands in `.canon/plans/archive/` indistinguishable from a shipped one by folder alone. The task file under `.canon/tasks/declined/` is what records which it was.

The move clears whichever of `priority.md` or `backlog.md` holds the task's row.
