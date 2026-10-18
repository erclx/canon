---
name: git-commit
description: What commit generation is for, the gaps it closes, and where the family boundary sits
---

# Git commit requirement

## Gap

Without this skill, a commit message takes whatever shape the session picks. The type and scope drift from the history's convention, the subject runs past the log's width, and a lockfile diff crowds out the change the message should describe.

A plain request to commit also reaches the grouping sibling, which restages whole files, so a hunk-level selection ships wider than the user reviewed.

## Must

- The message follows the commit format and versioning references
- The message describes the staged diff with lockfiles excluded
- The user sees the message and its length before the commit runs
- The committed set is exactly the staged set
- The description claims single-concern and hunk-level staged sets, and names `git-stage` for a mixed one

## Must not

- Stage or unstage anything
- Commit when nothing is staged
- Emit anything after the result line

## Out of scope

- Splitting a mixed diff into several commits, which `git-stage` owns
- Naming a branch, which `git-branch` owns
- Pushing or opening a pull request, which `git-pr` owns
