---
name: git-followup
description: What the follow-up push is for, the gaps it closes, and how it splits from opening a pull request
---

# Git followup requirement

## Gap

Without this skill, an edit made after a pull request is already open ships as a bare push. The body still describes the scope from before the edit, so a reviewer returning to the page reads a description the diff no longer matches. A reviewer who left comments gets no reply, and when a caller has already posted its own reply, a second one lands underneath it.

A caller that rebased the branch before handing over hits a rejected push, since the tracking branch no longer reaches the head. A branch entered through a worktree hits the opposite shape, carrying an open pull request with no tracking ref at all, which read as a branch that had never been pushed.

A fix commit answering a review is the sharpest case of the first paragraph, since it always changes what shipped. The routing that once picked whether to sync the body keyed off the same branch that decides whether to reply, so reaching `reply-owned` or a nonzero comment count meant the sync never ran at all. The description a merge record carries was true when the pull request opened and false by the time review finished, with nothing between the two that read it back.

## Must

- Refuse unless the branch has an open pull request, since every later step addresses it
- Set the tracking ref at the push when the branch has none, since a branch entered through a worktree carries an open pull request without one
- Delegate the message to `git-commit` rather than composing one, so a follow-up commit reads like every other commit
- Sync the body when the new commit moves the scope, and the title when the shift makes it inaccurate
- Reply on the pull request when it carries review comments, and scan that reply for the banned characters and internal phase labels before posting. The hook watches files and never sees a comment body on its way to the remote.
- Suppress the reply when the caller owns it, and still run the push and the body sync
- Read `canon pr evidence <number> --check --json` after posting the evidence and mint the preview when it is owed, since a followup that posts the evidence and stops leaves the preview for a relay
- Force the push under a lease when the tracking branch no longer reaches the head, so a caller's rebase lands and a commit this session never read is not overwritten

## Must not

- Run on `main`
- Open a pull request. A missing one is the stop condition, not a step to add.
- Post a second reply when the caller has already replied
- Emit anything after the result line

## Guards

- On `main`: stop and say to switch to a pull request branch
- Nothing changed: stop
- No open pull request: stop and route to the skill that opens one

## Out of scope

- Opening the pull request, which `git-pr` owns and `git-ship` chains
- Deciding what to fix from a review, which `review-address` owns. This skill is that flow's push leg and takes the fixes as already made.
- Grouping a multi-concern diff, which `git-stage` owns. A follow-up is one concern by definition, which is why this skill stages everything into a single commit.
