---
name: build-in-slices
description: Why a building session needs stated rules for working through a plan in committed slices and for leaving what it notices outside the plan, and where that discipline stops short of the test loop, code shape, and the worker's boundaries
---

# Build in slices requirement

## Gap

Nothing says how a session works through a plan once it starts building. `test-first` loops per behavior and stops at refactor, and `auto-ship` says to implement only what the plan describes. No skill asks for a commit per slice, a build left passing between slices, or a noticed defect written down rather than fixed.

Without those, a session builds in one pass and tests at the end, so the diff outgrows what anyone can read and a late failure could come from any change. A defect found on the way gets fixed in the same diff, and the review reads two changes as one.

## Must

- Work each slice as implement, run its tests and the checks its change could affect, commit through `git-commit`, then move on from the committed state
- Choose the next slice as one path end to end, the riskiest piece first, and the contract first when two sides are written against it
- Keep each commit safe to revert alone, with one logical change, a test committed with or ahead of its code, and no delete sharing a commit with its replacement
- Route a defect noticed outside the plan to the open task's findings or the handover, and leave its file unchanged
- Re-run a check only after an edit it could see, never as a reason to skip a verify step a chain runs, then close with excuses, red flags, and a checklist

## Must not

- Restate the scope floors of minimal edits and no unrequested features
- Carry simplicity or abstraction rules, a feature flag pattern, a framework, or a line-count threshold
- Describe a raw `git commit` recipe in place of `git-commit`
- Fix an outside defect on the branch unless the plan's own change cannot pass without it, and then say so in the commit

## Out of scope

- The red, green, refactor loop inside one behavior, which `test-first` owns
- Which layer a test belongs at, which `test-craft` owns
- The shape of a function, class, or module a slice writes, which `code-craft` owns
- What a building session may write and whom it reports to, which `role-worker` owns
- The message format of a commit, which `git-commit` owns
