---
name: git-followup
description: What the follow-up push is for, the gaps it closes, and how it splits from opening a pull request
---

# Git followup requirement

## Gap

Without this skill, an edit made after a pull request opens ships as a bare push. The body still describes the scope from before the edit, and a review fix always changes what shipped, so the description a merge records is false by the time review ends. A reviewer who left comments gets no reply, or a second one under the caller's own.

The push itself fails on two branch shapes. A caller that rebased before handing over hits a rejected push, and a branch entered through a worktree carries an open pull request with no tracking ref, which reads as a branch never pushed. A session that committed in slices arrives with a clean tree and is stopped by a guard that reads only the tree.

## Must

- Unpushed commits ship like uncommitted ones, with staging and the commit skipped on a clean tree, and a commit this skill makes takes its message from `git-commit`
- Every follow-up syncs the body when it moves the scope, and the title when the shift makes it inaccurate, whether or not a reply runs
- A pull request carrying review comments gets one reply, scanned for banned characters and phase labels and posted through a file, and none when the caller owns it
- The push lands on a branch with no tracking ref, and on a rebased one under a lease that protects a commit this session never read
- The evidence is posted through `pr-evidence` and read back with `canon pr evidence <number> --check --json`

## Must not

- Run on `main`, on a detached head, or with nothing to stage and nothing to push
- Open a pull request. A missing one is the stop.
- Post a second reply when the caller has already replied
- Emit anything after the result line

## Out of scope

- Opening the pull request, which `git-pr` owns and `git-ship` chains
- Deciding what to fix from a review, which `review-address` owns
- Grouping a multi-concern diff, which `git-stage` owns
