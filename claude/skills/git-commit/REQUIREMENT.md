---
name: git-commit
description: What commit generation is for, the gaps it closes, and where the family boundary sits
---

# Git commit requirement

## Gap

Without this skill, a commit message takes whatever shape the session picks. The type and scope drift from the history's convention, the subject runs past the log's width, and a lockfile diff crowds out the change the message should describe.

A plain request to commit also reaches the grouping sibling, which restages whole files, so a hunk-level selection ships wider than the user reviewed. No sibling amends either, so a session amends and force-pushes by hand, with nothing refusing another author's commit or one every clone holds.

## Must

- The message follows the commit format and versioning references, and describes the staged diff with lockfiles excluded
- The user sees the message, its length, and any commit it amends before the commit runs
- The committed set is exactly the staged set, whether it lands as a new commit or an amend
- An explicit ask to amend folds the staged set into `HEAD`, and pushes with `--force-with-lease` only when the same ask says to push
- The description claims single-concern and hunk-level staged sets, and names `git-stage` for a mixed one

## Must not

- Stage or unstage anything
- Commit when nothing is staged, unless an amend names a new message
- Amend on an ask that never said to, or amend a commit another author wrote
- Amend a commit the remote trunk holds once the repository has a merged pull request
- Emit anything after the result line

## Out of scope

- Splitting a mixed diff into several commits, which `git-stage` owns
- Naming a branch, which `git-branch` owns
- Pushing a new commit or opening a pull request, which `git-pr` owns
- Syncing an open pull request after a push, which `git-followup` owns
