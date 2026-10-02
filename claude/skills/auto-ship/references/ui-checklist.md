---
title: UI checklist counts
description: What auto-ship Step 5 holds when ui-checklist produces a checklist, so the closing block can name the unchecked visual boxes after git-pr has removed the file
---

# Hold the checklist counts

Step 5 of `auto-ship`. The session reads this file when `ui-checklist` has produced a checklist.

The chain continues to Step 6 here in every run, dispatched or hand-run, since the skill cannot tell the two apart and the draft mark at Step 8 holds the merge either way. A stop here used to leave nothing committed, and resuming at `/git-ship` skipped the review at Step 6.

Count two things in `.canon/tmp/handoff/ui-checklist/<slug>.md` at the main worktree root:

- `<N>`, the `- [ ]` lines
- `<M>`, how many of those end in `(taste)`

Hold both until the Output block. `git-pr` removes the file once it posts the evidence comment, so a count taken after Step 8 reads nothing.

The Output block's second line takes both counts. When every box is a taste box, `<N>` and `<M>` match and the boxes are owed to the operator alone, since a driver reports a taste box as needing a person's eyes rather than passing it, so say the operator and drop the UI reviewer clause.

When `ui-checklist` reports nothing to verify visually, it writes no file, Step 5 holds no count, and the Output block carries no boxes line.
