---
name: git-branch
description: What branch naming is for, the gaps it closes, and where the family boundary sits
---

# Git branch requirement

## Gap

Without this skill, a branch name is invented once per session. The type prefix drifts from the history's convention, the name runs past the width a pull request list renders, and a rename lands on a branch the remote already carries, which detaches every open pull request pointing at it.

A session standing on `main` has no route to its first act either. Every git operation goes through a `git-*` skill, so creating a feature's branch needs one that creates as well as renames, and that agrees with the name a dispatcher already checked.

## Must

- The name follows the branch format reference, and the user sees it with its length before the branch changes
- One skill creates on `main` or `master` and renames anywhere else
- A created name for a plan comes from `canon tasks plan-branch`, and a rename with no description derives from the commits ahead of main
- Remote existence is read before any rename or create, from the remote itself rather than the last fetch
- A conforming name passes through as a success, so a chained caller continues

## Must not

- Rename `main`, `master`, or a branch that exists on the remote
- Create from anywhere but `main` or `master`, or onto a name that exists locally or on the remote
- Invent a name when the plan verb refuses
- Fetch or stash while creating
- Emit anything after the result line

## Out of scope

- The commit message, which `git-commit` owns
- Pushing and opening the pull request, which `git-pr` owns and which refuses a non-conforming name
- Splitting a branch whose commits span concerns, which `git-split` owns
- Entering a worktree and naming its branch, which `session-worktree` owns
