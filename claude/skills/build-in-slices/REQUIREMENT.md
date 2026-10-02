---
name: build-in-slices
description: Why a building session needs stated rules for working through a plan in committed slices and for leaving what it notices outside the plan, and where that discipline stops short of the test loop, code shape, and the worker's boundaries
---

# Build in slices requirement

## Gap

Without this skill, nothing in the toolkit says how a session works through a plan once it starts building. `test-first` loops per behavior and stops at refactor, and `auto-ship` Step 2 says to implement only what the plan describes and nothing about how. No skill asks for a commit per slice, for a build left passing between slices, or for a defect noticed outside the plan to be written down rather than fixed.

The ship chain assumed the work arrives uncommitted. `git-ship` ran `git-stage` unconditionally, and that skill stops on an empty index, so a session that committed as it went never reached the pull request whenever the sync steps wrote nothing.

## Must

- State the cycle per slice: implement, run the slice's tests and the checks its change could affect, commit through `git-commit`, then move on from the committed state
- State how the next slice is chosen: one path end to end, the riskiest piece first, and the contract first when two sides are written against it
- Keep each commit safe to revert on its own: one logical change, a test committed with or ahead of its code, and never a delete and its replacement in one commit
- Route a defect noticed outside the plan to the open task's `## Findings`, or to the handover where no task exists, and leave its file unchanged
- Limit the rule against re-running a check on unchanged code to the session's own repeats, so it never reads as permission to skip a verify step a chain runs
- Record the external sources adopted and declined with the reason for each, so a later session extends the position instead of re-deriving it
- Close with a table of the excuses a session gives for skipping a slice commit or widening scope, each with its rebuttal, the red flags a session can see in its own work mid-task, and a checklist each line of which answers yes or no against the branch the build produced

## Must not

- Restate the scope floors `565-behavior` already carries for every session
- Carry simplicity or abstraction rules, which `code-craft` owns
- Name a feature flag pattern, since the slices of one branch merge as one pull request rather than reaching trunk one at a time
- Name a framework, a test runner, or a line-count threshold, none of which holds across stacks
- Describe a raw `git commit` recipe in place of `git-commit`

## Guards

- A change that is already one behavior in one place skips the skill
- A defect outside the plan is fixed on the branch only when the plan's own change cannot pass without it, and the commit says so

## Out of scope

- The red, green, refactor loop inside one behavior: `test-first`
- Which layer a test belongs at: `test-craft`
- The shape of a function, class, or module a slice writes: `code-craft`
- What a building session may write, the board it may not, and the messages it owes: `role-worker`
- The message format of a commit: `git-commit`
- Safe defaults for a new interface, which belong to the skill shaping what a caller sees
- Whether the guidance changes what a session ships, which needs a measured with-and-without run rather than a rule here
