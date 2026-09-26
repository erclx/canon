---
name: review-address
description: What the review return leg is for, the gaps it closes, and why the push lands before the reply
---

# Review address requirement

## Gap

Without this skill, review findings are worked in whatever order the author read them and the thread never records which landed. A reply posted before the push describes code the remote does not have, so a reviewer checks the branch and finds the old version. A failing check gets treated as separate from the review, which produces a follow-up that answers every comment and leaves continuous integration red. One finding nobody can resolve stalls the rest.

A branch also goes stale from `main` moving rather than from anything the branch did. Nothing in the return leg rebases it, so the worker closes every finding, reports the pull request answered, and the branch still cannot merge. Half the resolution is mechanical and wrong to do by hand, since a generated file merged manually produces a diff the next regen discards.

A declined finding fails on a third axis, which is where its reason ends up. A worker answering a dispatch by naming the plan question that already settled the finding, or the constraint the diff never showed, settles it in whichever session heard the answer. Both sessions end, so a reader opening the thread later finds a finding that stopped being mentioned and no record of what stopped it, which is the durability the posted review already has by design.

## Must

- Treat a failing check as a finding alongside the review comments, so the follow-up closes both
- Handle each finding independently, so one unresolved item does not block the others
- Verify before pushing, since a red follow-up costs the reviewer a second pass
- Rebase onto `origin/main` when the branch no longer merges, after the findings are addressed and before the push, so one force-push carries both
- Test staleness on every invocation, including one carrying no findings, since a branch goes stale from `main` moving rather than from anything the review said
- Re-test once the fixes are commits, since the first test reads committed history and cannot see a fix that touches lines `main` moved
- Rebuild a generated file through the project check rather than resolving its conflict by hand
- Push before replying, so the comment never runs ahead of the code it describes
- Map every finding to what changed, or to a one-line reason when it is a question or a conscious accept
- Carry the fact behind a declined finding into the posted reply rather than into the message that answered the dispatch, since both sessions end and the thread is what the next reader opens
- Append the closing confirmation to the reply only when the findings are addressed and every check passes
- Say what the run actually did on a rebase-only pass, since a reply mapping findings and a closing confirmation claiming they were addressed are both false on a pull request carrying none
- Scan the reply for banned characters and internal phase labels before posting, since the comment leaves for the remote unchecked

## Must not

- Merge, or read the closing confirmation as an approval. The author cannot approve their own pull request.
- Write a review. This skill consumes findings and does not produce them.
- Append the closing confirmation while a check is failing
- Reimplement the follow-up push or the doc refresh. Both have owners, and a second copy here drifts from them.
- Edit silently. A finding answered without a reply leaves the reviewer re-deriving the change from the diff.
- Answer a finding in the channel alone. A reply that changes what the review concluded is the one the thread has to carry.
- Post a correction to what the reviewing session believes about the world. That class changes no finding here and belongs in the session record.
- Take one side of a conflict wholesale. Both sides are valid content, so `--ours` or `--theirs` drops one silently and passes every check.
- Merge `main` into the branch. The repository squash-merges, so a merge commit reads as noise on the pull request.
- Guess at a hunk the tree does not settle. That case reaches the operator as an ordinary finding on the next pass only if the worker stops.

## Guards

- No open pull request for the current branch: stop
- The pull request carries no review comments or threads and the branch still merges: stop with a pass. A closed review says nothing about whether the branch still merges, so the staleness test decides this one rather than the finding count.
- A conflict needing a decision the tree does not carry: stop with the branch left on its old base

## Out of scope

- Writing the review, which `review-pr` owns. The split is by side of the channel: that one posts findings from an independent session and this one is the worker's return leg.
- Staging, committing, and pushing the follow-up, which `git-followup` owns under this skill's direction
- Refreshing the `.claude/` docs the fixes made stale, which `context-fold` owns
- Re-reviewing its own fixes, which hands back to the orchestrator
- Re-reading a rewritten branch, which `review-pr` absorbs by testing whether the prior reviewed commit still reaches the head and paying for a full pass when it does not
