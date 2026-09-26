---
title: Tasks archive
description: Archiving a shipped task by stem or pull request, declining one decided against, the refusal reasons each carries, and how the plan and ready folder move with the task
---

# Tasks archive

## Archive

`canon tasks archive` moves a shipped task from `.canon/tasks/` into `.canon/tasks/archive/`, drops its row from `priority.md`, and regenerates the board index. The three run as one unit, so the attended and unattended callers cannot archive differently.

Name the task by its filename stem, or by the pull request it carries:

```bash
canon tasks archive v28.1-trigger-escalation # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
canon tasks archive --pull-request 673 --json
```

| Option               | Behavior                                                     |
| -------------------- | ------------------------------------------------------------ |
| `--pull-request <n>` | Select the task whose `Pull request:` line names this number |
| `--json`             | Emit a machine-readable record on stdout                     |
| `--root <path>`      | Board root, defaulting to the main worktree                  |

Exit codes: `0` archived, `1` refused. Every gate is a refusal rather than a warning, because `.husky/post-merge` calls this with nobody watching. The `reason` field carries which gate fired: `no-board`, `no-match`, `ambiguous`, `no-outcomes`, `open-outcomes`, `earlier-slice`, or `bad-input`. `earlier-slice` fires when `--pull-request` names a number that is not the last on the task's `Pull request:` line, since outcomes are ticked at ship time and only the last slice's merge closes the task.

An outcome whose body is struck reads as cut rather than open or closed, whatever its checkbox holds: `- ~~<outcome>~~ <why>`. A task carrying only cut outcomes archives, since the gate refuses `no-outcomes` only when both the closed and the cut counts are zero. The success record carries `closed` and `cut` as counts, so a reader tells a shipped task from an abandoned one without opening the file.

The task carries its plan with it. When the closing task is the last live one whose `Plan:` line resolves onto that file, the plan moves to `.canon/plans/archive/` under its own name and the archived task's link is rewritten as `[feature-<slug>](../../plans/archive/feature-<slug>.md)`, a folder deeper than the live task wrote it. A line linking several plans moves each one no other live task cites and rewrites only those links. The `plans` array on the success record carries a `from` and `to` per moved plan in line order, and is empty when nothing moved.

Every other relative link in the task is re-resolved for the deeper folder too, whether its target moved or not: `Groundwork:`, `Intake:`, a `Plan:` or `Ready:` line whose target stayed put, and a link in the body. Fenced blocks, inline code spans, absolute URLs, `#` anchors, and rooted paths are left alone. `canon tasks decline` applies the same rebase, since `declined/` sits at the same depth. The plan retarget runs before the rebase and writes each moved link relative to the live board, so the rebase carries it into the deeper folder like every other link, while the ready retarget runs after it.

The ready folder the task's `Ready:` line names moves with the plan to `.canon/ready/archive/`, falling back to a `.canon/ready/<nn>-<slug>/` path in the plan when the line is absent. The `Ready:` line and the plan's literal path to the folder are retargeted, and the `ready` field on the success record carries `from` and `to`, or `null` when nothing moved. A folder that resolves to nothing, sits already archived, or meets a taken destination moves nothing and refuses nothing.

A plan several tasks share stays where it is, and its ready folder with it, and the task archives anyway. Moving it on the first task to close strands every sibling's pointer at a path that has gone, and `.canon/plans/` is gitignored so no history recovers the target. A `Plan:` line resolving to no file leaves the plan alone too, since a pointer somebody typed wrong is not a plan to move and holding the whole archive over it would park the board behind a repair the merge cannot make.

The merge is what settles a plan. `.husky/post-merge` reads the pull request number off the squash subject and calls this verb, so both halves close in one act with nobody naming a file. That is why the move sits inside this verb rather than in a second call the hook would make after it, which could leave the task archived and the plan live.

`bad-input` covers a malformed command line, which all three task verbs answer the same way. It is separate from `ambiguous` and `no-match` because those describe the board, and a caller that passed two selectors would otherwise be sent to repair a task citation that is fine.

The row is matched by the link in its first cell rather than by a pattern against the whole line. A row names the task it is about in the first cell, so a link anywhere after it is a reference, such as a blocker naming what it waits on, and matching the line would drop the referring task's row too.

The row removal reaches `priority.md` alone. A task gets to a merge by being planned and handed out, and both steps move it onto the board first, so one archived straight off `backlog.md` leaves its bullet standing and `canon tasks validate` reports that bullet as naming a file that is gone.

The board is shared scratch at the main worktree root, so `--root` defaults to the first entry of `git worktree list` rather than the working directory. A linked worktree archives against the same board every other session reads.

Skills branch on the reason rather than on the exit code:

```bash
canon tasks archive --pull-request 673 --json | jq -r 'if .ok then .task else .reason end'
```

## Decline

`canon tasks decline <task>` moves a task decided against from `.canon/tasks/` into `.canon/tasks/declined/`, clears whichever of `priority.md` or `backlog.md` holds its row, and regenerates the board index. Unlike `canon tasks archive`, it carries no outcome-state gate: a task can be decided against at any outcome state.

```bash
canon tasks decline v28.1-trigger-escalation --reason "superseded by v30.2" # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
canon tasks decline v28.1-trigger-escalation --reason "no longer needed" --by Alex --json
```

| Option            | Behavior                                          |
| ----------------- | ------------------------------------------------- |
| `--reason <text>` | Why the task was decided against, required        |
| `--by <name>`     | Who decided, defaulting to `git config user.name` |
| `--json`          | Emit a machine-readable record on stdout          |
| `--root <path>`   | Board root, defaulting to the main worktree       |

Exit codes: `0` declined, `1` refused. The `reason` field carries which gate fired: `no-board`, `no-match`, `ambiguous`, or `bad-input`. `bad-input` covers a missing `--reason` and a `--by` that resolves to nobody, git config included.

`DECLINE_REFUSALS` is kept apart from archive's own refusal set on purpose. Archive and decline answer different questions, shipped versus decided-against, and a shared gate would let one archive a task that cannot yet ship or decline one that already has.

The decision is written onto the task as a `Declined: <reason>, <who> on <YYYY-MM-DD>` line, anchored the same way `Pull request:` is, after the last origin line the task carries.

The task carries its plans with it the same way archive does, each one the declining task is the last live citation of, and the success record carries the same `plans` array. A declined task's plan lands in `.canon/plans/archive/`, indistinguishable from a shipped one by folder alone. The task file under `.canon/tasks/declined/` is what records which it was.

Skills branch on the reason rather than on the exit code, the same rule `canon tasks archive` states:

```bash
canon tasks decline v28.1-trigger-escalation --reason "superseded by v30.2" --json | jq -r 'if .ok then .task else .reason end' # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
```
