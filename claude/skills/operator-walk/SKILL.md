---
name: operator-walk
description: Writes every step the operator does by hand to one file, then walks it with them one step per turn, each with the exact action, what to expect, what to do when it differs, and the read-only check that marks it done. Use when a plan or an ask leaves console or terminal steps to the operator, or when asked to "walk me through it" or "which steps are left". Do NOT use to set up a deploy, which is `deploy-app`.
metadata:
  family: answer
---

# Operator walk

A list of hand steps said one message at a time lives only in the chat. Steps get swapped, a setting lost to an outage goes unnoticed, and nobody can say what is left. This skill writes the whole list to a file first, then walks it one step per turn, marking each step from a check rather than from memory.

Read `${CLAUDE_SKILL_DIR}/references/walk-file.md` before Step 1, for the step table, its states, and the fields each step carries.

## Steps

1. Write the walk file before saying any step.
   - Take the steps from the plan the session runs under, gathering every one its sections leave to the operator, or from the ask when no plan names them
   - Write the file at `.canon/tmp/<slug>/walk.md` at the main worktree root, with a kebab slug naming the walk, so it outlives the worktree and stays out of every records push
   - Resolve the main root and route the write the way `${CLAUDE_SKILL_DIR}/../session-worktree/references/main-root-writes.md` states, since a worktree's `Write` lands in a copy nobody reads
   - Give the operator the file's path and the step count, then go to Step 2
   - When the file already exists, read it rather than writing a second one, and open on the first step neither `done` nor `skipped`
2. Walk one step per turn.
   - Set the step to `next` in the file, then say it in the shape the file holds it, with each command in its own fenced block
   - Wait for the operator's reply before the next step
   - Run the step's read-only check on the reply, and mark it `done` only when the check passes. Mark `done, by the operator's word` where the step has no check.
   - Follow the step's `If it differs` path when the check fails or the operator reports something else, and mark it `blocked` with what it waits on when that path does not clear it
   - Mark a step `skipped` with its reason only on the operator's word
3. Close the walk.
   - Say which steps are `blocked` or unreached, with what each waits on, and the file's path
   - Leave the file in place, since a later session resumes from it

## The turn

Each turn carries one step and is read top to bottom, often in a hurry.

- Open the turn on a hold, ahead of the step, whenever the operator must not do something yet, such as merging or deleting the old setting
- Ask one open question per turn, since a bare yes to two questions answers neither
- Say to clear the terminal or close the tab showing a secret before any step that asks for a screenshot
- Keep a step's own output out of the turn when it printed a secret, and say only what it showed

## The file

The file is the record, and the chat is only where it is read aloud.

- Edit the file before saying a reordered, added, or changed step, so the chat never runs ahead of the record
- Write into the file only what a later session needs to resume, never a secret value, per `walk-file.md`
- Run nothing as a check that changes state. A check reads, and the operator acts.
