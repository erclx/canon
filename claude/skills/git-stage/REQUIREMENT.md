---
name: git-stage
description: What commit grouping is for, the gaps it closes, and how it differs from splitting a branch
---

# Git stage requirement

## Gap

Without this skill, a staged diff spanning several concerns lands as one commit, so a later revert takes unrelated work with it. A renamed file staged as two paths records an add and a delete, and commits land in listing order rather than dependency order, so a bisect stops on a commit that cannot build.

The routing fails on top of that. A description claiming every commit request pulls in single-concern sets with nothing to group, and a hunk-level selection reaching the unstage comes back widened to whole files.

## Must

- Each message follows the commit format reference, derived from the staged diff with lockfiles excluded, with each subject counted against the length limit before executing
- Every staged file is accounted for in the preview, and no file the user did not stage is committed
- Commits are ordered so a dependency lands before the file that imports it
- A rename pair stays in one group, so git still detects the rename
- The description declines single-concern and hunk-level staged sets and names `git-commit` for both

## Must not

- Stage a file the user did not stage
- Split a rename pair across groups
- Run when nothing is staged
- Emit anything after the result line

## Out of scope

- Composing one commit from the whole staged diff, which `git-commit` owns
- Splitting commits across branches, which `git-split` owns
- Pushing and opening the pull request, which `git-pr` owns
