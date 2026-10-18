---
name: git-worktree
description: What worktree listing and cleanup is for, the gaps it closes, and why entry lives elsewhere
---

# Git worktree requirement

## Gap

Without this skill, linked worktrees accumulate past the point where any of them is remembered. Merge state does not appear in the worktree list, so a cleanup either removes a worktree still holding unmerged work or removes nothing.

A plain ancestry read misses the whole set, since `git branch --merged` decorates every branch checked out in a worktree. Removing a worktree also leaves its local branch behind, so the branch list keeps growing even when cleanup runs.

## Must

- Merge state comes from the pull request first and from local ancestry matched on the branch name alone when no pull request exists
- A worktree and its local branch are removed together
- The main root, the current session's worktree, a dirty tree, a worktree outside the prefix `session-worktree` creates under, and one a live session occupies are never removed
- Every skipped row carries a one-word reason, and an empty remove set says why each row was held
- Each run is exactly one of listing or removing

## Must not

- Enter or create a worktree
- Remove a dirty or occupied worktree, whatever its merge state
- Remove the worktree the session runs in
- Run outside a git repository
- Emit anything after the result line

## Out of scope

- Entering a worktree, which `session-worktree` owns
- Writing pull request state, which `git-pr` and `git-followup` own
- Deciding which features can run in parallel, which the planning skills own
