---
name: role-reviewer
description: What a dispatched reviewing session is, what it writes and reads, the acts it refuses, and the one message it owes the session that dispatched it
---

# Role reviewer requirement

## Gap

Without this skill, review is the one stage that does not fan out. Every first pass runs inside the controlling session with several pull requests in one context, and that session skims the docs a branch touches. A cold session reviewing one pull request finds what it missed.

Each launch also restates the reviewer's bounds, though they belong to the role. A reviewer asked to fix has reviewed its own change, and one posting a close is a step from readying the pull request, skipping the gates `canon pr lift` reads. One with no checkout reads the trunk, so its findings describe a tree the pull request never changed.

## Must

- The role is asserted, with writes bounded to the comment and body file the pass posts, and the tracked file, branch, worktree, board, and commit named as outside them
- Every file read a finding rests on goes through `git show <head>:<path>` at the resolved head, and launch-carried cross-branch facts are inputs
- The fix, a draft lift by any route but `canon pr lift`, and the merge are refused whoever asks, naming each owner, and the lift runs after a close is posted
- An open pass sends the worker the `review-address` dispatch and this session's id, else the controller the cause, and a close sends the lift's reason unless the other review is open or missing
- A re-review stays with the reviewer that took the first pass while it is live, and a block is messaged before it becomes an interactive prompt

## Must not

- Restate `review-pr`'s steps and headings, `review-craft`'s criteria, or a boundary another role states about itself
- Report progress through the channel, or post outside `review-pr` and `review-ui`
- Review as though the branch had no plan when it does not resolve, and instead report it unreadable naming the main-root path
- Exist for the author to type its name, since a stretch where only a typed invocation reaches it signals the role never took

## Out of scope

- The pass itself, its scope, body, and post, which `review-pr` owns
- What a review looks for, which `review-craft` owns
- The cross-branch pass per wave and which pull requests take a reviewer, which `role-orchestrator` owns
- Answering the review, which `review-address` owns
- The mechanical addressee resolution, which `session-relay` owns
