---
title: Review findings
description: How auto-ship Step 7 splits the review receipt's findings by origin, which ones it repairs in place and which stop the chain, and the one-pass bound on the repair
---

# Evaluate the review findings

Step 7 of `auto-ship`. The session reads this file when Step 6 ran review rather than skipping it.

Read `.canon/review/branch-<slug>.md` at the main worktree root. Split every finding by origin before parsing the summary line (`X critical, Y should-fix, Z minor`), since the stop exists for a defect the branch inherited.

- **This run caused it, at any severity.** Fix it, re-run the Step 3 verify commands, re-read the fixed file against what the finding claimed, and continue. Do not report it as a stop or offer the fix as a choice.
- **It predates this run, critical or should-fix.** Stop: `❌ Review found non-minor issues that predate this run. See .canon/review/branch-<slug>.md. Fix and run /git-ship.`
- **It predates this run, minor only.** Continue. The minor findings stay in the on-disk review receipt. Fold any a reviewer needs into the PR's `## Technical Context`. Do not add a separate review-notes section to the PR body.

Read origin as causation rather than authorship, so staleness this run induced in a file it never opened is a finding it caused.

Bound the repair at one pass, the way Step 3 bounds verify. When that re-read shows the finding still standing, stop: `❌ A self-introduced finding survived one fix pass. See .canon/review/branch-<slug>.md. Fix and run /git-ship.`

This chain owns the receipt's lifetime. The `context-fold` sweep under Step 8 reaches only reports whose branch is gone, so it collects this one a branch later.
