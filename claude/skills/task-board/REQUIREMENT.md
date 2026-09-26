---
name: task-board
description: Why creating and archiving a task file is one skill, the origin invariant enforceable only at creation, and why archiving routes through the command the merge hook calls
---

# Task board requirement

## Gap

Without this skill, a task file gets a filename and frontmatter invented on the spot, so the board sorts wrong and the regenerated index reads fields that are not there. A task arrives with no origin, which is either lost context or work nobody decided to do, and by the time anyone notices there is no way to recover which it was. The phase label gets derived from a version file rather than from what the board already means, and a single-digit phase sorts after a double-digit one because nobody padded it. A label picked off the live board alone repeats one the archive already spent, since the archive holds most of what has ever been allocated and a board-only scan cannot see it.

Archiving fails in two ways that both lose work. Moving the file, editing the ordering file, and regenerating the index as three separate acts drifts from the one command the merge hook calls, so the attended and unattended paths stop agreeing. And an all-`[x]` task gets archived while its pull request is still open, because marking outcomes happens on the branch as the first step of shipping. The board is gitignored, so nothing restores a task archived early.

Placing a row without checking for another writer collides the same way. Two sessions filing work at once can claim one phase label twice or land two rows beside each other unread, since neither reads the board before writing it.

## Must

- Resolve the board at the main worktree root, since a linked worktree writing to `pwd` creates a second board nothing reads
- Read the tasks standard before writing, rather than working the filename and frontmatter from memory
- Require an origin at creation, because that is the only moment the invariant is enforceable
- Claim the phase label with `canon tasks next-label --claim` rather than reading or proposing one by hand
- Check the roster for a live orchestrator before writing a row, and hand off rather than write when one is found
- Confirm the work reached the default branch before archiving
- Run the archive command and route on the reason it refuses, since each reason has one resolution
- Report an origin that carries no task, as a list rather than a prompt

## Must not

- Mark an outcome complete or archive a plan
- Hand-edit the index or the ordering file, or move the task file directly
- Write a pull request line at creation, when any number is a guess at someone else's work
- Archive around a refusal
- Split the legacy single-file archive into per-task files nobody wrote
- Fall through to a direct write when no orchestrator is found and this session's own name starts with `worker-` or `planner-`, since those role bodies ban the write with no exception

## Guards

- No task board at the main root: stop
- The request fits neither creating nor archiving: stop rather than picking one
- Work not yet on the default branch: stop, because the board has no history to restore from
- No origin given and none offered: stop

## Out of scope

- Editing the contents of a task that already exists, which `context-fold` owns along with marking outcomes and sweeping plans
- Deciding what the task should argue. This owns the file's existence and its shape, not its content.
- Relocating a plan, which one skill owns so two do not relocate it differently
