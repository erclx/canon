---
title: An unusable diff baseline
description: When task-complete's diff baseline is unusable, what the marking step reads to recover the committed half, and why that widened read is safe here
---

# An unusable diff baseline

Step 1 of `task-complete`'s Mark mode. The session reads this file when no merge base resolves or the base came from local `main` and equals HEAD.

The baseline is unusable in two cases:

- No merge base resolves against either ref.
- The base came from local `main` and equals HEAD. Nothing is pushed to compare against, so a narrow read reports no changes rather than admitting it cannot see them.

An unusable baseline costs only the committed half. `git diff <base> HEAD` is empty by definition once the base equals HEAD, while `git diff HEAD` and `git ls-files --others --exclude-standard` still report uncommitted and untracked work at correct scope.

Recover the committed half. Read `git log -p -1`, widening to `git log -p -<n>` when the session spans several commits, and read the candidate task files against the working tree. That yields names and content both, which is what lets Step 2 decide on behavior rather than on filenames. A fresh `git init` on `main` with no remote is the ordinary shape of a scaffolded project, so this path carries the evidence rather than covering an edge case.

On a fresh `git init` project the last commit is the scaffold commit, so `git log -p -1` is the whole tree by another route. The marking step tolerates that because it only reads the diff, and it matches conservatively against outcomes already on the board. Widening what a step reads is safe. Never carry the widened set into a step that writes per file.
