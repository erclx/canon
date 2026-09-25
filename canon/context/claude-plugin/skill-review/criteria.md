---
title: Criteria
description: Why what a review looks for lives in review-craft rather than in either review procedure, why security and rendered output are references rather than skills, why the filter and severity stayed behind, and why the rendered-output read uses the posted comment
---

# Criteria

`review-craft` carries what a review looks for and the evidence bar, while `review-pr` and `review-branch` carry the procedure: which files a pass reads, the high-signal filter, the severity ladder, and where the report lands. Both procedure bodies load it at the step where they review.

## Why criteria split from procedure

The split copies `test-craft` and `test-first`. Before it, the axis list was a short sentence copied between the two review bodies, and extending it meant editing both and hoping they stayed in step. One criteria body read by every procedure is one place to extend, and a third reader, such as a dispatched reviewer, loads the same body rather than a third copy.

## Why security and rendered output are references

A pass that fires only when a session names it is the pass nobody names. A standalone security skill or a standalone screenshot skill would load on an explicit request and stay silent on the ordinary review, which is where both were missing. As references inside the criteria skill, each loads on a condition the diff meets, being a sink the diff reaches or a file that paints.

## Why the filter and the severity stayed behind

The two procedures grade on different ladders. `review-pr` routes a dispatch on its threshold and `review-branch` routes the ship chain on its own, and the two define `should-fix` differently. A criteria body stating a severity would contradict one of them. The references say flag, and the procedure grades.

The design axis has to survive the filter both bodies carry against subjective suggestions, which is why the body states a design finding as a concrete cost.

## Why the rendered read uses the posted comment

`canon pr evidence` reads the local checkout's diff and names a pull request's head, so a reviewing session not on the branch compares the wrong change. The posted comment is what the author and the reviewer both see. The reference reads the comment, fetches the pull request head, and writes each image out with `git show` at the sha its row names, since the embedded address serves nothing to a session from a private repository.

## What the red runs measured

Each sandbox arm ran once against the bodies before this skill existed.

- `claude:review-craft`: both runs caught the planted security defect under the one-word axis, first an `eval` over the arguments and then an unpinned package, and both called the README clean while its Safety section promised a guard the diff deleted. The stale claim outside the hunk is what the arm discriminates on.
- `claude:review-pr missing-evidence`: with the capture convention stated in the fixture's `CLAUDE.md`, the pass caught the missing screenshot off that sentence alone. With the sentence removed and only the trunk's `evidence/` folder left, it did not mention the absence.
- `claude:review-pr evidence-mismatch`: the pass filed the collapse finding off the stylesheet diff and said it had not rendered the page. No image landed on disk.

## What the green runs showed

The first runs with the skill in place failed on loading rather than on judgment. `review-branch` never invoked the skill while the pointer sat as the first item of its list, and one `review-pr` pass skipped the Step 3 pointer entirely. Both bodies now open the review step with an instruction to invoke the skill before reading anything for findings, and each run since has loaded it.

The references loaded less reliably than the skill. One `missing-evidence` pass read `ui.md` and went straight to posting without running the check for an absent screenshot, which sat at the end of the reference. That check now opens the reference, carrying the command that decides finding against question. A later pass skipped the reference and raised the gap anyway, off the committed capture it found in the tree. Another ran that command in the same batch as the write that posted its body, and noticed the finding only after posting, so the reference now asks for the answer before any body is composed. The run after that filed the absent screenshot as a graded finding against the pull request, citing the committed capture the check found.

## Open

Whether a dispatched reviewer role also needs to exist is left to the trial that adds one. It would load this skill rather than carry axes of its own.
