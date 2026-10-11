---
name: task-complete
description: Why marking shipped outcomes and archiving a shipped task sit in one skill, why the diff decides completion alone, and why the ship chain marks but never archives
---

# Task complete requirement

## Gap

Without this skill, the board describes the scope a branch opened with. An outcome the diff shipped stays unchecked, so the board reports finished work as open and the next session re-plans it. When marking rode inside the context fold, it kept a ten-step skill running on every ship for a write that had nothing to do with the context entries, and a session reading the fold's name never learned that it also wrote the board.

Archiving fails in two ways that both lose work. Moving the file, editing the ordering file, and regenerating the index as three separate acts drifts from the one command the merge hook calls, so the attended and unattended paths stop agreeing. And an all-`[x]` task gets archived while its pull request is still open, because marking happens on the branch as a ship-chain step. The board is gitignored, so nothing restores a task archived early.

Review receipts pile up the same way. A branch report is read once by the session addressing it, and nothing but an operator asking ever collected one whose branch was gone, so the folder grew per shipped branch and never shrank.

## Must

- Take completion from the diff, since completion is a fact about the repository rather than about the conversation
- Match an outcome on the behavior it names, never on a filename or a commit subject
- Leave an outcome unchecked when the diff is ambiguous. An unmarked shipped outcome costs one manual edit and a wrongly marked one hides work that never happened.
- Close outcomes through `canon tasks outcome` and branch on the record's `ok` and `reason` rather than the exit
- Resolve the board at the main worktree root, since a linked worktree reading `pwd` finds no board
- Sweep a branch review report whose branch no longer exists, and leave the current branch's receipt alone, since its branch is still live
- Confirm the work reached the default branch before archiving
- Run the archive command and route on the reason it refuses, since each reason has one resolution

## Must not

- Infer a new task from the diff. Only outcomes already on the board get marked.
- Touch a task file the diff does not relate to
- Archive from the ship chain. The pull request has not merged there, and the `post-merge` hook archives through the same command once it does.
- Hand-edit the index or the ordering file, or move a task file or a plan directly
- Archive around a refusal
- Split the legacy single-file archive into per-task files nobody wrote
- Widen what the marking step reads into a write when the baseline is unusable

## Guards

- No task board at the main root: Mark reports one skip line and returns, since the ship chain runs it on every project, and Archive stops naming the command that sets one up
- Work not yet on the default branch when archiving: stop, because the board has no history to restore from

## Out of scope

- Creating or declining a task, which `task-board` owns
- The context entries, which `context-fold` owns
- The unattended archive at merge, which the `post-merge` hook runs through `canon tasks archive`
- Regenerating the task index, owned by a hook
