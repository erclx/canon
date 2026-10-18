---
title: An unusable diff baseline
description: When context-fold's diff baseline is unusable, why Step 3 keeps the scoped set rather than the whole tree
---

# An unusable diff baseline

The Diff baseline section of `context-fold`. The session reads this file when no merge base resolves or the base came from local `main` and equals HEAD.

The baseline is unusable in two cases:

- No merge base resolves against either ref.
- The base came from local `main` and equals HEAD. Nothing is pushed to compare against, so a narrow read reports no changes rather than admitting it cannot see them.

An unusable baseline costs only the committed half. `git diff <base> HEAD` is empty by definition once the base equals HEAD, while `git diff HEAD` and `git ls-files --others --exclude-standard` still report uncommitted and untracked work at correct scope.

## Step 3 keeps the scoped set

Run Step 3 on the working tree and untracked files alone, and skip only when that set comes out empty, reporting the warning its own reference names. Widening what a step reads is safe, and widening what a step writes is not.

- Never substitute the whole tree for a missing baseline, and do not widen to `git log -p -1` for coverage
- On a fresh `git init` project the last commit is the scaffold, so that read is the whole tree by another route. Step 3 writes, so it would rewrite every context entry that tree touches.
- `task-complete` takes the widened read for its marking step, which only reads and matches conservatively against outcomes already on the board
