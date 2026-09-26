---
title: Archive a shipped task
description: How task-board confirms a task's work reached main, runs canon tasks archive, routes each refusal, and clears prose naming the archived task
---

# Archive a shipped task

The Archive mode of `task-board`. The session reads this file when the request names a task file already shipped.

The `post-merge` git hook archives the task a merge closed, so a request arriving here is usually one the hook could not resolve on its own. Run the steps below against whatever the hook left in place.

Do not move the file, edit `priority.md`, or regenerate the index by hand. `canon tasks archive` owns all three as one unit and the hook calls the same command, so a hand-rolled move here drifts from the unattended path.

## Step 1: confirm the work reached main

`context-fold` marks outcomes on the branch as step 1 of the ship chain, so an all-`[x]` task routinely describes a pull request that is still open. The command gates on the outcomes and cannot tell those two apart, which is what puts this check here:

```bash
git fetch origin main --quiet && git log origin/main --oneline -20
```

Match the shipped outcomes against that log, widening to `gh pr list --state merged --limit 20` when a remote is configured and the log does not settle it. When the work is not on `main`, name the task and stop: `❌ Work not on main. Archiving now loses the task if the pull request is abandoned.`

The board is gitignored, so an archived task has no history behind it and nothing restores one archived early. Skip this check when the task carries a `Pull request:` line and the last number it lists is merged, since the number already proves what the log is being read for.

## Step 2: run the archive

Pass the task's filename stem, or the pull request number when the request names one:

```bash
canon tasks archive <stem> --json
```

The command refuses rather than reports, and the refusal reaches this skill through the record rather than through the exit. Branch on `ok`, then on `reason`. An operator's shell profile may wrap `canon` in a function that runs the binary and then a second command and takes the second status, which masks every non-zero exit rather than only an absent verb. The binary exits 1 for an unknown subcommand and 1 for an ordinary refusal alike, so the record is the only signal that survives the wrapper.

On success the record carries `from`, `to`, `priorityRowRemoved`, and `indexRegenerated`, which is what moved, what row it cleared, and whether the index changed. It also carries `plans`, one `from` and `to` for each live plan the task was the last live citation of, in the order its `Plan:` line links them. An empty `plans` means the task cited no live plan, or that a sibling still holds every one it cited.

## Step 3: route on a refusal

Each reason has one resolution and none of them is to archive around it:

- `open-outcomes`: the named outcomes are unmarked or genuinely open. Run `context-fold` when the work shipped and nothing marked it. Leave the task on the board when the outcome is real. When the work is being abandoned, cut it by striking the body, `- ~~<outcome>~~ <why>`, whatever the checkbox holds, so the board records what was dropped rather than meeting this refusal a second time.
- `ambiguous`: two tasks name one pull request, which is the misfile `${CLAUDE_SKILL_DIR}/../../standards/tasks.md` rules out. Resolve the citation by hand, since no sweep repairs it.
- `earlier-slice`: the number is listed on the task but is not the last, so a later slice is still to merge. Leave the task on the board. Its last slice's merge archives it.
- `pending-branch`: a branch named in `detail` ticked an outcome before its own pull request number was recorded. Leave the task live, since that branch's merge archives it once `git-pr` records the number. When the operator decides a named branch was abandoned, archive by stem, which is the one case for it.
- `no-match`: the stem or number names nothing on the board. Check the name against the listed stems.
- `bad-input`: the command line was wrong rather than the board. Read the message, fix the arguments, and run it again. Nothing on the board needs repair, which is what separates this from the two above.

Do not move a plan by hand from this skill. The command carries the plan with the task when no other live task cites it, and retargets the archived task's `Plan:` line at the new path. A second mover drifts into relocating the same file differently.

Leave `TASK-ARCHIVE.md` alone when it is present in the archive folder. It records the single-file era in the shape that era used, and splitting it would fabricate per-task files nobody wrote.

## Step 4: clear prose naming the task

The command drops the task's row from `.canon/tasks/priority.md` and leaves prose alone. Remove any sentence that still names the archived task or counts the rows that changed, since a stale count reads as board state.
