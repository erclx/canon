---
title: Criteria
description: Why review criteria live in review-craft, why security and rendered output are references, and why the rendered read uses the posted comment
---

# Criteria

`review-craft` carries what a review looks for and the evidence bar. `review-pr` carries the procedure, being the files a pass reads, the high-signal filter, the severity ladder, and where the report lands. Its body loads the criteria at the step where it reviews.

## Decisions

### Why criteria split from procedure

The split copies `test-craft` and `test-first`. The axis list was a short sentence copied between the two review bodies, so extending it meant editing both and hoping they stayed in step.

One criteria body is one place to extend, and a third reader such as a dispatched reviewer loads the same body rather than a third copy.

### Why security and rendered output are references

A pass that fires only when a session names it is the pass nobody names. A standalone skill would load on request and stay silent on the ordinary review, which is where both were missing. As references, each loads on a condition the diff meets, being a sink the diff reaches or a file that paints.

A third reference, for a dependency upgrade, was planned and not built.

- A seeded branch bumping a dependency across a major version, beside a lockfile adding a transitive package with an install script, passed every assertion without it
- It is a floor, and the amendment to the requirement's reference limit had no miss to cite
- `references/adopted.md` records the decline and when to revisit it

The security reference took two lifts with no miss to measure, a threat-model opening and a class for a delete or clean on a derived path.

### Why the filter and severity stayed behind

`review-pr` grades on its own ladder and routes a dispatch on its threshold, so a criteria body stating a severity would contradict it. The references say flag and the procedure grades.

The design axis has to survive the filter both bodies carry against subjective suggestions, so the body states a design finding as a concrete cost.

### Why the design walk and two axes sit in the body

Guard the bar and performance sit after tests and ahead of the conditional axes. Guard the bar reads the files the tests axis just read, and performance is correctness at scale, so neither waits on a condition.

The nine-step design walk stays in the body because every review reads the design axis, and a reference would cost a read on every run. The body is a practice skill, so it closes on the excuses, red flags, and checklist sections and records its sources in `references/adopted.md`.

### Why the rendered read uses the posted comment

`canon pr evidence` renders a new body from the pull request's files, which can differ from the comment already posted. The posted comment is what the author and the reviewer both see.

The reference reads that comment, fetches the head, and writes each image out with `git show` at the sha its row names. The embedded address serves nothing to a session from a private repository.

### What the red runs measured

Each sandbox arm ran once against the bodies before this skill existed.

- `claude:review-craft` caught the planted security defect under the one-word axis in both runs, an `eval` over the arguments and then an unpinned package
- Both runs called the README clean while its Safety section promised a guard the diff deleted, and that stale claim outside the hunk is what the arm discriminates on
- A third plant, a branch leaving the changed script out of its lint run, came with the guard-the-bar axis. The earlier body caught it, so it holds a floor.
- `claude:review-pr missing-evidence` caught the missing screenshot off one sentence of capture convention in the fixture's `CLAUDE.md`, and without it never mentioned the absence
- `claude:review-pr evidence-mismatch` filed the collapse finding off the stylesheet diff, said it had not rendered the page, and wrote no image to disk

### What the green runs showed

The first runs with the skill failed on loading rather than judgment. One `review-pr` pass skipped the Step 3 pointer, so the body now opens the review step with an instruction to invoke the skill before reading anything for findings. Each run since has loaded it.

The references loaded less reliably than the skill.

- One `missing-evidence` pass posted without running the absent-screenshot check at the end of `ui.md`, so that check now opens the reference with the command that decides finding against question
- A later pass skipped the reference and raised the gap anyway, off the committed capture in the tree
- Another ran the command in the same batch as the post, so the reference now asks for the answer before any body is composed
- The next run filed the absent screenshot as a graded finding, citing the capture the check found

## Gotchas

### Open

Whether a dispatched reviewer role also needs to exist is left to the trial that adds one. It would load this skill rather than carry axes of its own.
