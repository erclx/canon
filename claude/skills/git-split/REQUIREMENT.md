---
name: git-split
description: What branch splitting is for, the gaps it closes, and how it differs from grouping a staged diff
---

# Git split requirement

## Gap

Without this skill, a branch carrying unrelated commits ships as one pull request, which a reviewer skims because no single concern holds it together. Split by hand, commits get cherry-picked in an order that leaves a branch missing something it depends on, and a dirty tree loses its uncommitted work across the checkouts.

Merging the wrong branch first lands every other branch's content on main and leaves the remaining pull requests empty after rebase, with no signal that anything went wrong. Every body leaves through `gh`, which the audit hook never watches, so a banned character survives into a published pull request.

## Must

- Groups follow concern from both commit messages and file paths, preferring fewer branches, and every commit ahead of main is accounted for in the preview
- Each group is classified independent or stacked before any command is generated, and stacked mode carries the restack loop
- The merge order and its reason are stated
- Every generated title and body is scanned for banned characters and phase labels before a pull request opens

## Must not

- Run on a dirty tree, on `main`, or with no commits ahead of main
- Split when one concern already covers the branch
- Rename a branch whose name already matches its concern
- Leave a commit unaccounted for
- Merge the pull requests it opens

## Out of scope

- Partitioning a staged diff into commits, which `git-stage` owns
- The message on each commit, which `git-commit` owns
