---
name: draft-ready
description: Why writing a ready folder, its overview, the thin plan, and the task row is one invocation rather than four hand writes, and where the boundary against the planning and shipping skills falls
---

# Draft ready requirement

## Gap

Without this skill, a session holding finished files that hands them to a worker:

- Writes the folder, the overview, the plan, and the task row as four separate hand writes, and the four drift from each other because nothing compares them.
- Lists a destination in the overview that the plan's `**Files to touch:**` omits, or the reverse. The omitted path is invisible to `plan-reach`, so a second track writes the same file and neither side finds out.
- Picks the next ordinal by reading only the live folder, and reuses a number an archived folder already spent, which the pull request that shipped it cites by name.
- Picks a phase label by scanning the live board alone, which is the scan that let two sessions hand out one label within minutes of each other.
- Leaves the plan's `**Constraints:**` without a line naming the folder as the verbatim source, so the worker reads the files as inspiration and writes its own version.
- Leaves a note, an alternate, or a draft passage in the folder beside the real files, so the worker guesses which one is the source.
- Writes into the main worktree root from a linked worktree with `Edit` or `Write`, which the isolation guard refuses, and takes the refusal's redirect into a second gitignored copy no later session reads.
- Reports the handoff as done while the archive move at the end, which no verb performs, is left for someone to remember.

## Must

- Refuse before writing when the operator has named no finished file, since a folder assembled from a description is a plan with extra steps.
- Read the ordinal from the live folder and its archive together, so a spent number is never reused.
- Take the phase label from `canon tasks next-label` rather than from a scan of its own.
- Derive the overview's `destinations` and the plan's `**Files to touch:**` from one list, and compare the two before reporting, so neither can name a path the other lacks.
- Write the plan's `**Constraints:**` line naming the folder as the verbatim source.
- Copy each finished file whole to its destination path inside the folder, and carry nothing else into it.
- Write the plan and the task through `canon tasks plan-link`, `canon records validate plans`, and `canon markdown audit` rather than by restating what those verbs check.
- Place the task's row by the three branches `task-board` Step 4 states, so a solo project never ends with a task file on no surface.
- Route a write at the main root from a linked worktree through `Bash`, the way `session-worktree` routes it.
- Name the archive move in the closing report, since the skill writes a folder that stays live until someone moves it.

## Must not

- Edit a finished file. The worker copies verbatim, so a change made here is a change the warm session should have made before invoking the skill.
- Hardcode a branch type, which `branch.md` owns, or restate the folder shape, which `ready.md` owns.
- Write `priority.md` or `backlog.md` where an orchestrator is on the roster or the session is a worker or planner, since one board writer at a time is what keeps a gitignored board safe. Those two cases report the row instead.
- Automate the archive move. No verb owns the relocation, and a skill doing it by hand would be the second copy of a step the standard already states.
- Dispatch or start the worker, which belongs to whoever runs the board.

## Guards

- No finished file named, stop: `❌ No finished file named. A ready folder carries text that already exists, so write the files first or use /canon:plan-feature.`
- A named file that does not resolve, stop: `❌ <path> does not exist. Name a file that is already written.`

## Out of scope

- `plan-feature` writes a plan describing a change nobody has written yet. This begins from text already written and writes a plan thin enough to point at it.
- `role-worker` copies the folder into a worktree and ships it. This stops once the three artifacts exist.
- `task-board` creates a task file for a row with no ready folder. This writes the row it needs beside the folder and calls the same verbs.
- `git-ship` ships a branch, and a ready folder never reaches one.
- `standards/ready.md` owns the folder's shape and lifecycle, and this skill owns the procedure that produces it, the way `write-human` and `500-prose` split.
