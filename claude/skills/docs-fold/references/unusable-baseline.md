---
title: An unusable diff baseline
description: When docs-fold's diff baseline is unusable, what Step 2 reads to recover the committed half, and why Steps 4, 5, and 7 keep the scoped set rather than the whole tree
---

# An unusable diff baseline

The Diff baseline section of `docs-fold`. The session reads this file when no merge base resolves or the base came from local `main` and equals HEAD.

The baseline is unusable in two cases:

- No merge base resolves against either ref.
- The base came from local `main` and equals HEAD. Nothing is pushed to compare against, so a narrow read reports no changes rather than admitting it cannot see them.

An unusable baseline costs only the committed half. `git diff <base> HEAD` is empty by definition once the base equals HEAD, while `git diff HEAD` and `git ls-files --others --exclude-standard` still report uncommitted and untracked work at correct scope.

**Step 2 recovers the committed half.** Read `git log -p -1`, widening to `git log -p -<n>` when the session spans several commits, and read the candidate task files against the working tree. That yields names and content both, which is what lets Step 2 decide on behavior rather than on filenames. A fresh `git init` on `main` with no remote is the ordinary shape of a scaffolded project, so this path carries the evidence rather than covering an edge case.

**Steps 4, 5, and 7 keep the scoped set.** Run them on the working tree and untracked files alone, and skip only when that set comes out empty, each reporting the warning its own step names.

Never substitute the whole tree for a missing baseline, and do not reuse Step 2's commit read in these three for consistency. On a fresh `git init` project the last commit is the scaffold commit, so `git log -p -1` is the whole tree by another route. Step 2 tolerates that because it only reads, and it matches conservatively against outcomes already on the board. Steps 4 and 7 write, so the same set stubs a wireframe for every uncovered surface in the repository and rewrites every context entry that tree touches.

Step 5 only reports, and the whole tree costs it a different way. Every anchored decision cites a path the scaffold commit carries, so the sweep flags the entire record and the reader learns nothing about which number moved.

Widening what a step reads is safe. Widening what a step writes is not, and widening what a step flags spends the reader's attention on entries nothing put in doubt.
