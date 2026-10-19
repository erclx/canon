---
title: Tasks reference
description: Folder layout, filename convention, file format, origin lines, and archiving for task files under .canon/tasks/
---

# Tasks reference

Applies to `.canon/tasks/`. Tracks what is being built and why, at the level of features and outcomes, one file per task. Update a task when it starts, completes, or changes scope.

- When to open a task at all is project policy rather than a shape rule, and lives in `CLAUDE.md`
- The folder is gitignored, since committing board state would put a claim about the future into an unrelated pull request

## Contents

- [Scope](#scope)
- [Layout](#layout)
- [Filenames](#filenames)
- [Frontmatter](#frontmatter)
- [File format](#file-format)
- [Origin](#origin)
- [What goes in](#what-goes-in)
- [What does not go in](#what-does-not-go-in)
- [Archiving](#archiving)

## Scope

Governs the task files under `.canon/tasks/`: folder layout, filenames, frontmatter, file format, origin lines, and archiving.

Does not govern:

- **`tasks-decline.md`**: the declined folder, the `Declined:` line, and what declining does to a plan and a board row
- **`board.md`**: execution order, readiness groups, the backlog, and the generated index beside the tasks
- **`plan.md`**: the plan file a task cites, its sections, and its answer contract
- **`versioning.md`**: phase-label format and which surfaces a label may appear on
- **`session.md`**: the pre-compaction handoff sitting in the folder, its filename and its sections
- **project policy**: when a project opens a task at all, which is a policy rather than a shape rule

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

One file per task keeps the board safe under parallel sessions, since a gitignored board has no history to recover a clobbered write from.

- Siblings are governed elsewhere, `index.md`, `priority.md`, and `backlog.md` by `board.md` and each `session-` file by `session.md`. A name outside that set is a task.
- `task-board` creates and declines task files, and `task-complete` marks outcomes `[x]` and archives a shipped task with its plan

## Filenames

`vXX.Y-<slug>.md`, where the version is the phase label zero-padded to two digits and the slug is kebab-case.

Padding is load-bearing. Index entries sort by filename alone, so a bare `v9.0` sorts after `v15.0` and the catalog reads out of board order. <!-- canon-allow-reference: illustrates the padding rule's own sort collision, not a citation of a real task -->

- `${CLAUDE_SKILL_DIR}/../git-commit/references/versioning.md` governs the label and permits free renumbering, so expect the occasional rename
- Nothing points at a task filename, since a `Plan:` line runs from task to plan rather than the reverse

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

Two headings, `## Outcomes` and `## Findings`. Outcomes are future and checkable and findings are past and factual, yet as flat bullets they look identical, so a heading separates them at no cost.

- Add no third heading. Status stays inline on an outcome rather than becoming an "In progress" section.
- Outcomes stay a checklist, since the board tools read them by their `- [ ]` line
- Open each finding with a bold label naming its source and date, as in `- **planner, 2026-10-11:** <finding>`. Keep it to a few sentences, moving anything longer into the plan or groundwork folder.

### Sizing outcomes

Size the outcomes so one pull request closes all of them, and split the task before handing it off rather than after. A task closes whole, so outcomes spanning two pull requests leave the board showing work no branch carries.

A sliced task is the one exception, shipped across several pull requests on purpose by the operator. Its `Pull request:` line lists every slice, and it closes when the last slice's merge finds every outcome ticked and no slice pending.

### Title and template

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

- **<source>, <YYYY-MM-DD>:** What constrains the task.

> Test strategy: <unit | component | e2e | visual | manual>, what is being verified
```

## Origin

Every task names where it came from, through a `Plan:`, `Groundwork:`, `Intake:`, or `Issue:` line under the title. Include each only when the file, folder, or issue it names exists.

### Both directions

A task with no origin is lost context or work nobody decided to do. The reverse bites harder, since a groundwork track, intake folder, or open issue no task points at is decided work being forgotten, and an intake folder fully answered with no task citing it, live, archived, or declined, is a dump nobody acted on.

### Link form

`Plan:`, `Groundwork:`, `Intake:`, and `Ready:` name their target as a markdown link whose text is the stem, so the line resolves on a ctrl-click as `priority.md` rows do.

- Write the path relative to `.canon/tasks/`, as `../plans/`, `../groundwork/`, and `../intake/`. A path from the project root resolves to nothing in an editor rooted there.
- `Issue:` stays a bare `#NNN`, since a full URL writes the remote into a gitignored file. Several issues list comma-separated, each getting a `git-pr` closing line.
- `Ready:` links `../ready/<nn>-<slug>/`, the folder the plan copies from, only when it exists. `canon tasks archive` reads it to move the folder, falling back to a path in the plan.

### The `Plan:` line

`Plan:` points at `../plans/feature-<slug>.md` while the task is open. Retarget both halves of the link as things move rather than dropping it, so a completed task still leads to its reasoning.

| State                         | Target                                  |
| ----------------------------- | --------------------------------------- |
| Open                          | `../plans/feature-<slug>.md`            |
| Shipped, plan archived        | `../plans/archive/feature-<slug>.md`    |
| Task archived a folder deeper | `../../plans/archive/feature-<slug>.md` |

- One plan per task, or one per slice as distinct plans on one line. A plan cited by two tasks is a misfile.
- `canon tasks plan-link <task> <plan>` writes or corrects the line, and `--add` appends a slice's plan, so it is never hand-edited
- Leave an older `../plans-archive/` or `../.tmp/plans-archive/` pointer alone, since it resolves and retargeting without moving the plan leads nowhere

### The `Groundwork:` and `Intake:` lines

`Groundwork:` points at `../groundwork/<slug>/`, the folder `plan-groundwork` fills. `Intake:` points at `../intake/<slug>/`, the folder an intake pass fills.

- Use `Groundwork:` alone for its key. `Research record` and `Decision record` are earlier spellings and both convert to it.
- Use `Intake:` rather than `Groundwork:` for an intake pass, so the line records which kind of pass produced the task
- `Intake:` names the folder rather than an item, and item numbers belong in the task's `## Findings`

### The `Pull request:` line

`Pull request:` lists every pull request that shipped part of the task as bare numbers, oldest first and comma-separated, as in `Pull request: #NNN, #NNN`. It is not an origin, so a task without one is well-formed, and `git-pr` appends to it when a pull request opens.

The line lets a merge close its own task. `canon tasks archive --pull-request <n>` finds the task by any listed number and archives it only on the last.

- One pull request, one task. Two tasks naming the same number refuse to archive rather than both moving.
- `Pending branch: <branch>` holds that merge back while a branch that ticked an outcome waits on its own number
- `canon tasks outcome` writes that line, skipping it when the branch's pull request is already listed, and `canon tasks pull-request` clears it

## What goes in

- Task entries describing observable behavior, one outcome per line
- A test strategy line naming the mechanism and what it verifies
- Findings stating what constrains the task, including blockers and dependencies
- A deviation from the plan's suggestion, in one line naming what moved the pick. The plan is archived at ship and holds the reasoning, so this register carries what shipped.

## What does not go in

- Class names, file paths, function names, or prop names in any entry or title
- Code-level steps or implementation detail. Behavioral specifics are fine.
- Architectural reasoning that outlives the task. A decision the system keeps after the task closes belongs in the context entry of the domain it constrains.

### Narrative and sequencing

Session history and ordering both have homes off the task file.

- Narrative of the session that produced the task. What was probed, what it cost, and who decided belongs in the groundwork folder, and a task with none cuts it, since the board is no fallback.
- "In progress" or "Blocked" headings. Note status inline on the outcome instead.
- Sequencing rationale or which version is active. It goes on the task's `priority.md` row, and rationale wider than one row is cut.

## Archiving

Never delete a task file. A shipped task moves to `.canon/tasks/archive/` under its own name through `canon tasks archive`, and the live index regenerates without it. What the verb does and refuses on is at `canon tasks archive --help`.

### The plan and ready folder

Archiving a task archives its plan alongside it when the task is that plan's last live citation. A plan several tasks share stays live with its ready folder, and the task archives anyway.

- The archived task's `Plan:` line is retargeted at `../../plans/archive/feature-<slug>.md`
- The folder its `Ready:` line names moves to `.canon/ready/archive/<nn>-<slug>/`, and both pointers to it are retargeted

### Open outcomes

A task with an open outcome stays on the board, and so does its plan. Close it, or cut an abandoned outcome by striking its body, as `- ~~<outcome>~~ <why>`, which reads as cut whatever its checkbox holds, so a task of cut outcomes still archives. A check only the operator can run takes `- [ ] Operator check: <outcome>`, written before the pull request opens, and the task closes with it unticked. Work the repository owes never takes it.
