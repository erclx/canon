---
name: task-complete
description: Why marking shipped outcomes and archiving a shipped task sit in one skill, why the diff decides completion alone, and why the ship chain marks but never archives
---

# Task complete requirement

## Gap

Without this skill, the board describes the scope a branch opened with. An outcome the diff shipped stays unchecked, so finished work reads as open and the next session re-plans it. Review receipts pile up the same way, since nothing collects a branch report once its branch is gone.

Archiving fails in two ways that both lose work. Moving the file, editing the ordering file, and regenerating the index by hand drifts from the one command the merge hook calls. A task whose outcomes are all checked gets archived while its pull request is still open, and the board is gitignored, so nothing restores it.

## Must

- Completion comes from the diff, matched on the behavior an outcome names rather than a filename or commit subject, and an ambiguous outcome stays unchecked
- Outcomes close through `canon tasks outcome`, routed on the record's `ok` and `reason` rather than the exit
- The board resolves at the main worktree root, and a missing board costs the ship chain one skip line
- A review report whose branch is gone is swept, and the current branch's receipt is left alone
- An archive runs only once the work is on the default branch, through `canon tasks archive`, routed on the reason it refuses

## Must not

- Infer a new task from the diff, or touch a task file the diff does not relate to
- Archive from the ship chain, where the pull request has not merged yet
- Hand-edit the index or the ordering file, or move a task file or a plan directly
- Archive around a refusal, or split the legacy single-file archive into per-task files nobody wrote
- Widen what the marking step reads into a write when the baseline is unusable

## Out of scope

- Creating or declining a task, which `task-board` owns
- The context entries, which `context-fold` owns
- The unattended archive at merge, which the `post-merge` hook owns through `canon tasks archive`
