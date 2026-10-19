---
title: Archive a shipped task
description: How task-complete confirms a task's work reached main, runs canon tasks archive, routes each refusal, and clears prose naming the archived task
---

# Archive a shipped task

The Archive mode of `task-complete`. The session reads this file when the request names a task file already shipped.

- The `post-merge` git hook archives the task a merge closed, so a request here is usually one the hook could not resolve. Run the steps against whatever it left in place.
- `canon tasks archive` moves the file, edits `priority.md` and `backlog.md`, and regenerates the index as one unit. The hook calls it too, so a hand-rolled move drifts from the unattended path.

## Step 1: confirm the work reached main

`task-complete` marks outcomes on the branch as step 2 of the ship chain, so an all-`[x]` task routinely describes a pull request still open. The command gates on the outcomes and cannot tell the two apart, which puts this check here:

```bash
git fetch origin main --quiet && git log origin/main --oneline -20
```

Match the shipped outcomes against that log, widening to `gh pr list --state merged --limit 20` when a remote is configured and the log does not settle it.

- When the work is not on `main`, name the task and stop: `❌ Work not on main. Archiving now loses the task if the pull request is abandoned.`
- The board is gitignored, so nothing restores a task archived early
- Skip the check when the task's `Pull request:` line lists a merged last number, which already proves what the log is read for

## Step 2: run the archive

Pass the task's filename stem, or the pull request number when the request names one:

```bash
canon tasks archive <stem> --json
```

The command refuses rather than reports, so branch on the record's `ok`, then on `reason`, never on the exit.

- An operator's shell profile may wrap `canon` in a function that takes a second command's status, masking every non-zero exit
- The binary exits 1 for an unknown subcommand and an ordinary refusal alike, so the record is the only signal that survives the wrapper

### Success record

A successful archive returns one record naming what moved.

| Field                | Holds                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| `from`, `to`         | The task's old and new path                                           |
| `priorityRowRemoved` | Whether a `priority.md` row was dropped                               |
| `backlogRowRemoved`  | Whether a `backlog.md` bullet was dropped                             |
| `indexRegenerated`   | Whether the index changed                                             |
| `plans`              | A `from` and `to` per live plan the task last cited, in `Plan:` order |

An empty `plans` means the task cited no live plan, or a sibling still holds every one it cited.

## Step 3: route on a refusal

Each reason has one resolution, and none of them is to archive around it.

- `open-outcomes`: the named outcomes are unmarked or genuinely open. Run `task-complete` when the work shipped unmarked, and leave the task on the board when the outcome is real.
  - An outcome only the operator can check is marked `- [ ] Operator check: <outcome>` rather than struck, which the archive passes and the record lists under `operatorChecks`. Mark an unmarked one before archiving.
  - An outcome another repository owes, or abandoned work, is the exception that takes the strike. The orchestrator's merge sweep strikes it with its reason and lists it in the report, per `${CLAUDE_SKILL_DIR}/../role-orchestrator/references/orchestrator-refill.md`, and the archive then runs. An outcome this repository owes is never struck for that.
- `ambiguous`: two tasks name one pull request, the misfile `${CLAUDE_SKILL_DIR}/references/tasks.md` rules out. Resolve the citation by hand, since no sweep repairs it.
- `earlier-slice`: the number is listed on the task but is not the last. Leave the task on the board, and its last slice's merge archives it.

### Abandoned outcomes

When the work behind an open outcome is abandoned, cut it by striking the body, `- ~~<outcome>~~ <why>`, whatever the checkbox holds. The board then records what was dropped rather than meeting this refusal again.

### Branches, matches, and input

The remaining three name a pending branch, a missing match, or a malformed call.

- `pending-branch`: a branch named in `detail` ticked an outcome before its pull request number was recorded. Leave the task live, since that merge archives it once `git-pr` records the number.
- An operator who decides the named branch was abandoned archives by stem, the one case for it
- `no-match`: the stem or number names nothing on the board. Check the name against the listed stems.
- `bad-input`: the command line was wrong rather than the board, so nothing needs repair. Read the message, fix the arguments, and rerun.

### What to leave alone

Never move a plan by hand from this skill. The command carries the plan along when no other live task cites it and retargets the `Plan:` line, and a second mover relocates the same file differently.

Leave `TASK-ARCHIVE.md` alone when it is present in the archive folder. It records the single-file era in that era's shape, and splitting it would fabricate per-task files nobody wrote.

## Step 4: clear prose naming the task

The command drops the row from `.canon/tasks/priority.md` and the bullet from `.canon/tasks/backlog.md`, and leaves prose alone. Remove any sentence that still names the archived task or counts the changed rows, since a stale count reads as board state.
