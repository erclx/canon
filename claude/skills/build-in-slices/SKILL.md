---
name: build-in-slices
description: Carries how a building session works through an approved plan in thin slices, each one tested, committed, and left green before the next starts, and how it records what it noticed outside the plan rather than fixing it. Use before implementing a plan that touches more than one behavior or file, when a branch is piling up uncommitted work, or when asked "how should I build this", "how do I avoid one giant diff", "should I commit this now", or "should I fix this while I'm here". Do NOT use for the red, green, refactor loop inside one behavior, which is `test-first`, to shape the code a slice writes, which is `code-craft`, or to decide what a worker may write, which is `role-worker`.
metadata:
  family: build
---

# Build in slices

A session handed a plan tends to build all of it in one pass and test at the end. The diff grows past what anyone can read, a failure late in the run could have come from any of the changes, and nothing in history marks a point that worked. A defect it notices on the way gets fixed in the same diff, so the review reads two changes as one. This skill carries the discipline that keeps each step small enough to verify and revert on its own.

Load it before implementing a plan with more than one behavior or more than one file to change. Skip it for a change that is already one behavior in one place.

## Run the cycle per slice

Each slice is the smallest piece of the plan that works on its own.

1. Implement the slice, driving each behavior in it through `test-first`.
2. Run the slice's own tests and every check its change could affect, such as the type checker over a changed signature or the linter over a changed file.
3. Commit the slice through `canon:git-commit`, staging only the files the slice changed. Report it rather than proceeding silently when that skill does not resolve.
4. Move to the next slice from the committed state, carrying forward rather than restarting.

Leave the build passing at every commit. A slice that cannot pass on its own is two slices in the wrong order, or one slice cut too thin to stand.

## Choose the next slice

- Prefer one path through every layer it needs, end to end, over one whole layer at a time. A finished path proves the layers fit, and a finished layer proves nothing until the next one meets it.
- Take the riskiest or least certain piece first. When it fails, the slices that would have rested on it are not built yet.
- Build the contract first when two sides are written against it, such as a command and the skill that calls it, or a format and its reader. Commit the contract as its own slice, then each side against it.
- Read the plan's file list as the scope of the whole branch, not as the order. Cut the order from the three rules above.

## Keep each commit safe to revert on its own

- Make each commit one logical change. A new behavior, a refactor it needed, and a configuration change are three commits.
- Commit a slice's test with its code or ahead of it, never after. A test landing in a later commit reads to `canon gov test-order` as code that reached history untested.
- Never delete something and add its replacement in one commit. Add the replacement, move callers to it, then delete the original, so reverting any one step leaves a working tree.
- Keep edits to existing code narrow, so a revert removes the slice and nothing a later slice leaned on.

## Note what you notice, and leave it

A defect outside the plan that turns up mid-build is a finding, not a slice. Fixing it on this branch widens a diff the plan scoped and hides the fix inside an unrelated review.

- Write it in one line under the open task's `## Findings`, naming the file and what is wrong, when the build is closing a task.
- Carry it in the handover message instead when no task exists, and never create a file to hold it.
- Leave the file as it is, even when the fix is one line.
- Fix it here only when the plan's own change cannot pass without it, and then say so in the commit that does.

## Run a check when the code under it changed

- Re-run a check after an edit it could see, not as reassurance. A second pass over unchanged code reports what the first pass already did.
- This covers repeats a session makes on its own between slices. A verify step a chain or a ship gate runs is a separate decision with its own reason, so run it whenever the chain reaches it.

Read `${CLAUDE_SKILL_DIR}/references/adopted.md` only when extending this guidance or arguing against a rule in it. It records which external sources were adopted, which declined, and why.

## Excuses and rebuttals

| Excuse                                           | Rebuttal                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| I will test it all at the end                    | A defect in the first slice makes every later one wrong, and a failure at the end could have come from any of them. |
| It is faster to build it in one pass             | It is faster until something breaks and the cause sits somewhere in a diff nobody can bisect.                       |
| These changes are too small to commit separately | A small commit costs one message. A large one hides which change broke the build and cannot be reverted in part.    |
| The ship step commits everything anyway          | It groups what is left by concern after the fact. It cannot recover which state worked between slices.              |
| This fix is one line, so it can ride along       | It lands in a review scoped to something else, and reverting the slice it rode in reverts the fix too.              |
| The refactor is small enough to include          | A refactor mixed into a feature makes both harder to review and to revert. Commit it as its own slice first.        |
| I will commit the test once the code settles     | The code reaches history untested, and `canon gov test-order` reports the pair on every later run of the branch.    |
| Let me run the suite once more just to be sure   | Nothing changed since it passed. Run it again after the next edit, where it can find something.                     |

## Red flags

- The working tree holds changes from more than one slice and none of them is committed.
- The next commit message needs "and" to say what it does.
- A slice has been implemented and its tests have not run yet.
- The build or a test is failing and the next slice has already started.
- You opened a file the plan does not name and are about to edit it.
- A commit deletes code and adds its replacement in the same change.
- You are about to stage a test in a commit after the one that added its code.
- You are running the same check twice with no edit between the runs.

## Before handing over

Check each line against the branch the build produced. A line answering no is fixed or reported, never left with a note.

- Every commit on the branch carries one logical change and passed the checks it could affect.
- No commit adds code whose test lands in a later commit.
- No commit deletes something and adds its replacement together.
- The working tree holds no uncommitted implementation work.
- Every file changed is in the plan's scope, or its commit says why the plan needed it.
- Every defect noticed outside the plan is written in the task's findings or the handover, and its file is unchanged.

## What this delegates

- The red, green, refactor loop inside one behavior: `test-first`
- Which layer a slice's test belongs at: `test-craft`
- The shape of the code a slice writes, including when an abstraction earns its place: `code-craft`
- What a building session may write and whom it reports to: `role-worker`
- Writing the commit message for a staged slice: `git-commit`
