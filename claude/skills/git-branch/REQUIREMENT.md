---
name: git-branch
description: What branch naming is for, the gaps it closes, and where the family boundary sits
---

# Git branch requirement

## Gap

Without this skill, a branch name is invented once per session. The type prefix drifts from what the history already carries, the name runs past the width a pull request list renders, and a rename lands on a branch that already exists on the remote, which detaches every open pull request pointing at it.

A session standing on `main` has no route either. The `git.md` rule sends every git operation through a `git-*` skill, and the only one for branches stopped on `Cannot rename a protected branch`, so the first act of any feature, creating its branch, had no skill to go through.

## Must

- Read the branch format reference before generating, so the type vocabulary and the length limit come from one source
- Create the branch on `main` or `master` and rename it anywhere else, so one skill covers both ends of a branch's start
- Derive the name from the commits ahead of main when a rename carries no description
- Take a created name from `canon tasks plan-branch` when the invocation names a plan, so the skill and the dispatch gate hold one derivation
- Resolve whether the branch exists on the remote before proposing a rename, since the hazard is invisible from local state
- Read the remote itself with `git ls-remote` before creating, since `origin/<name>` sees only the last fetch
- Show the name and its length against the limit before renaming or creating
- Execute immediately after the preview. The tool permission dialog is the confirmation gate.

## Must not

- Rename `main` or `master`
- Rename when the current name already conforms. The skill is chained, so a conforming name has to pass through rather than churn the branch.
- Rename a branch that exists on the remote. Local rename plus force push is not the same operation and it breaks the pull request.
- Create a branch from anywhere but `main` or `master`, or create one whose name exists locally or on the remote
- Invent a name when the plan verb refuses, since a name the skill calls non-conforming strands the rename at ship
- Fetch or stash while creating
- Emit anything after the result line

## Guards

- Create with no plan and no name: stop and name both missing inputs
- Create with a name breaking the branch standard: stop and name the cap
- Create with a name existing locally or on the remote: stop and say which
- Rename name already conforms: stop with a success marker, not a failure, since a chained caller continues past it
- Rename with no commits and no description: stop and name both missing inputs
- Rename of a branch existing on the remote: stop and route to the surface that preserves the pull request link

## Out of scope

- The commit message, which `git-commit` owns
- Pushing and opening the pull request, which `git-pr` owns. That skill reads a conforming name as a precondition and refuses without one, so this skill runs first.
- Splitting a branch whose commits span concerns, which `git-split` owns
- Entering a worktree, which `session-worktree` owns and which names its own branch
