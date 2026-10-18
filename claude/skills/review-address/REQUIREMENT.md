---
name: review-address
description: What the review return leg is for, the gaps it closes, and why the push lands before the reply
---

# Review address requirement

## Gap

Without this skill, review findings are worked in whatever order the author read them and the thread never records which landed. A reply posted before the push describes code the remote does not have. A failing check is treated as separate from the review, so the follow-up answers every comment and leaves continuous integration red.

A branch goes stale as `main` moves, and nothing rebases it, so every finding closes and the pull request still cannot merge. Merging a generated file by hand yields a diff the next regen discards. A declined finding's reason lives in a session that ends, so the thread keeps no record of it.

## Must

- A failing check is handled as a finding beside the review comments, each finding independently, and the fixes are verified before the push
- Staleness is tested on every invocation, and the branch rebases onto `origin/main` before the push when it no longer merges or `main` changed a file it writes
- A conflict keeps both sides and rebuilds a generated file through the project check
- The push lands before the reply, and the reply maps each finding to what changed or to a reason, carrying the fact behind a declined one
- The closing confirmation appears only when every finding is addressed and every check passes, and the reply is scanned for banned characters and phase labels first

## Must not

- Merge, write a review, or read the closing confirmation as an approval
- Merge `main` into the branch or take one side of a conflict wholesale
- Guess at a hunk the tree does not settle, and stop with the branch on its old base, messaging the controlling session when the launch named one
- Edit silently, or answer a finding in the channel alone
- Run without an open pull request for the branch

## Out of scope

- Writing the review, which `review-pr` owns
- Staging, committing, and pushing the follow-up, which `git-followup` owns
- Refreshing the `.claude/` docs the fixes made stale, which `context-fold` owns
- Re-reviewing its own fixes, which hands back to the reviewer
