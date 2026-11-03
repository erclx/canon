---
title: UI checklist counts
description: What auto-ship Step 5 holds when ui-checklist produces a checklist, so the closing block can name the unchecked visual boxes after pr-evidence has removed the file
---

# Hold the checklist counts

Step 5 of `auto-ship`. The session reads this file when `ui-checklist` has produced a checklist.

The chain continues to Step 6 here in every run, dispatched or hand-run, since the skill cannot tell the two apart and the draft mark at Step 6 holds the merge either way.

## What to count

Count two things in `.canon/tmp/handoff/ui-checklist/<slug>.md` at the main worktree root:

- `<N>`, the `- [ ]` lines
- `<M>`, how many of those carry `(taste)` among their trailing markers

Hold both until the Output block. `pr-evidence` removes the file once it posts the evidence comment, so a count taken after Step 6 reads nothing.

## Owed fixture states

Settle each state the checklist names before Step 6, since a box the driver cannot reach opens the UI review.

- Add the state to the drive fixture for each box ending in `(needs fixture)`, then drop the marker from the box
- Confirm every state the checklist names has a capture case, per the `canon:ui-craft` capture reference, and add the missing ones
- A project with no `canon/config/app-drive.toml` takes the setup inline on the box instead of a fixture file

## Reading the counts into the closing block

The Output block's second line takes both counts. When every box is a taste box, `<N>` and `<M>` match and the boxes are owed to the operator alone, so say the operator and drop the UI reviewer clause.

- A driver reports a taste box as needing a person's eyes rather than passing it, which is why the operator owns an all-taste set
- When `ui-checklist` reports nothing to verify visually, it writes no file, Step 5 holds no count, and the Output block carries no boxes line
