---
title: Tasks
description: Claiming the next phase label, recording a pull request number and closing an outcome, listing each task's readiness, and where archiving, the plan verbs, and board validation are described
---

# Tasks

## Next label

`canon tasks next-label` reports the next unused phase label, reading `.canon/tasks/` and its `archive/` sibling together. A scan confined to the live board is blind to every label the archive already spent, which is what let two sessions hand out the same label within minutes of each other. Bare, it reports and never writes. With `--claim` it reserves the label first.

```bash
canon tasks next-label
canon tasks next-label --json
canon tasks next-label --claim --json
```

| Option          | Effect                                           |
| --------------- | ------------------------------------------------ |
| `--json`        | Emit a machine-readable record on stdout         |
| `--claim`       | Reserve the label so a second claim gets another |
| `--root <path>` | Board root, defaulting to the main worktree      |

The record carries `label`, the next free `vXX.Y`, `claimed`, whether the label was reserved, and `highest`, the label it was derived from. `highest` is absent when neither folder carries a label yet, and `label` reads `v01.0` in that case, matching the zero-padded-major shape every other label already takes. <!-- canon-allow-reference: illustrates the verb's answer for a board holding no label yet, not a citation of a real task -->

Exit codes: `0` derived, `1` refused with `no-board`, `2` refused with `label-contended` after five lost reservations, on `--claim` only.

The minor digit rolls from 9 to 0 on the next major rather than growing a second digit, which is the single-digit-minor shape every phase label already takes. `canon tasks archive` moves a task's file from the live folder into the archive without renumbering it, so the same label counts toward the maximum wherever it currently sits, and a label claimed by two different files folds into the same scan without a dedicated check.

A claim is an exclusive `mkdir` at `.canon/ordinal-locks/<label>`, and the scan counts every reservation beside the task files, since the file lands after the verb returns. Reservations never expire, so a claim that died leaves a gap, which `standards/versioning.md` permits. A bare read still reports without reserving, and it does not count reservations either, so it can return a label a claim already holds until that claim's task file lands. Two bare reads in the same second can also take the same answer.

```bash
canon tasks next-label --json | jq -r '.label'
```

## Archive and decline

`canon tasks archive` moves a shipped task into `.canon/tasks/archive/`, selected by its stem or by the pull request it carries, and `canon tasks decline` moves one decided against into `.canon/tasks/declined/`. Both carry the plan and the ready folder along when the task is their last citation. The selectors, the gates, and the refusal reasons are in `tasks-archive.md`.

## Plan verbs

Five verbs read or write the plan a task cites. `plan-citations` reports where it sits and who else cites it, `plan-answers` whether it still waits on the operator, `plan-branch` the branch it derives, `plan-reach` what a branch reached against what the plan declared, and `plan-link` writes the task's `Plan:` line. Each verb's record, exit codes, and refusals are in `tasks-plans.md`.

## Pull request

`canon tasks pull-request` records the number a branch's pull request carries onto the task that branch closes. It adds `Pull request: #NNN` under the `Plan:`, `Groundwork:`, `Intake:`, or `Issue:` lines the task already holds. When the line exists it appends `, #NNN` rather than replacing it, so a task shipped in slices lists every pull request oldest first, and a number already listed leaves the line alone. A line that does not read as a comma-separated list of `#NNN` entries is replaced whole.

Name the task by its filename stem, or by the plan its `Plan:` line points at:

```bash
canon tasks pull-request 673 v28.1-trigger-escalation # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
canon tasks pull-request 673 --plan worktree-scratch-routing --json
```

| Option          | Behavior                                           |
| --------------- | -------------------------------------------------- |
| `--plan <slug>` | Select the task whose `Plan:` line names this plan |
| `--json`        | Emit a machine-readable record on stdout           |
| `--root <path>` | Board root, defaulting to the main worktree        |

A plan is matched on the token both spellings share, so `worktree-scratch-routing`, `feature-worktree-scratch-routing`, and `.canon/plans/feature-worktree-scratch-routing.md` all select the same task. The `action` field reports `added`, `appended`, `corrected`, or `unchanged`, which makes a rerun against the same number safe.

Exit codes: `0` recorded, `1` refused. The `reason` field carries `no-board`, `no-match`, or `ambiguous`. `git-pr` skips silently on those three, because each is a case where a guessed write would archive the wrong task once the branch merges.

A malformed argument refuses as `bad-input` instead, which sits outside that set on purpose. `git-pr` derives the number by slicing whatever `gh pr create` printed, so a non-numeric value is reachable, and folding it into the swallowed set would lose the number with nothing reporting it.

## Outcome

`canon tasks outcome` marks outcomes `[x]` on a task by their position in its outcome list, counting every checkbox in file order from 1.

```bash
canon tasks outcome v28.1-trigger-escalation --close 1 --close 3 # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
canon tasks outcome --plan worktree-scratch-routing --close 2 --json
```

| Option               | Behavior                                           |
| -------------------- | -------------------------------------------------- |
| `--close <position>` | Outcome to mark `[x]`, 1-based, repeatable         |
| `--plan <slug>`      | Select the task whose `Plan:` line names this plan |
| `--json`             | Emit a machine-readable record on stdout           |
| `--root <path>`      | Board root, defaulting to the main worktree        |

An outcome already closed comes back under `alreadyClosed` rather than refusing, so a rerun against the same positions changes nothing. A position past the end of the list refuses as `out-of-range`, since a caller counting wrong should hear about it rather than mark a neighbor.

Positions skip fenced blocks. A checkbox inside a sample a task displays is not an outcome the task claims, and counting one would shift every position after it. `canon tasks archive` reads the list through the same walker, so the two verbs cannot disagree about which checkboxes are outcomes.

Exit codes: `0` closed, `1` refused. The `reason` field adds `no-outcomes`, `out-of-range`, and `bad-input` to the three above.

Both verbs exist because the write is an edit inside a file that already exists. `Edit` and `Write` refuse a main-root path from a linked worktree, and a shell stream editor is banned for in-place edits, so a verb resolving the board root in-process is the only route a skill body has. Creating a whole file needs no verb, because a heredoc through `Bash` writes it safely.

## List

`canon tasks list` reports each live task file with its readiness, so a reader learns which file is parked and which is live without opening `priority.md` or `backlog.md`. It reads and never writes, and every file stays in the folder it is in.

```bash
canon tasks list
canon tasks list --json
```

| Option          | Effect                                      |
| --------------- | ------------------------------------------- |
| `--json`        | Emit a machine-readable record on stdout    |
| `--root <path>` | Board root, defaulting to the main worktree |

The record carries `tasks`, one entry per file with its `stem` and its `readiness`. Readiness is one of `Run now`, `Up next`, `Needs a plan`, `backlog`, `unplaced`, or `both`. The first three are the group names the board standard fixes, `backlog` is a line on `backlog.md`, `unplaced` is a file neither surface names, and `both` is a file both surfaces name, which `validate` reports as a finding and this verb does not judge.

The verb calls the parsers `validate` uses, so the two cannot disagree on what a surface names. It lists the live root only, never `archive/` or `declined/`, and skips the same siblings `validate` skips.

Exit codes: `0` derived, `1` refused with `no-board`.

```bash
canon tasks list --json | jq -r '.tasks[] | select(.readiness == "backlog") | .stem'
```

## Validate

`canon tasks validate` reports what each row of `priority.md` and each line of `backlog.md` claims against what the tree holds. Its seven checks, the three arrays that move no exit code, and the refusals are in `tasks-validate.md`.

For the board format, the `Pull request:` line, and the archive rules, see `standards/tasks.md`.
