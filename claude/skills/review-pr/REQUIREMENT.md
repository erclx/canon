---
name: review-pr
description: What the independent pull request review is for, the gaps it closes, and why it posts until nothing is open
---

# Review PR requirement

## Gap

Without this skill, a pull request is reviewed only by the session that wrote it, which cannot see the board's order or a sibling branch in flight. Findings land in chat, where they are read once and leave the thread with no record. A review that opens and never closes is worse than none, since a reader scanning the thread cannot tell an unanswered review from a confirmed one, and the author's claim that findings are fixed is the only evidence they are.

A finding also stops being true by argument rather than by a fix. A worker naming the plan question that already declined it, or a constraint the pass could not see, settles it in the exchange that carried the answer, and the pass that accepts the argument drops the finding from its next body. A reader then sees a finding raised once and never mentioned again, which is indistinguishable from one everyone forgot.

A request written under `## For the reviewer` also reached no reader. The authoring standard names it as what the reviewing session should confirm, and nothing on this side read the section by that name, so a branch author's question sat in the body until this skill answered it.

## Must

- Post until the review closes. A first pass opens against the whole change, and each later pass checks whether the prior findings landed.
- Set the heading from the finding count rather than the pass number, so the most recent review comment's heading reports whether anything is open
- Detect the pass from the thread rather than taking it from the caller, matching the heading for equality so a neighboring comment cannot be read as a prior pass
- Scope a later pass to the commits added since the prior one, once that commit is confirmed to still reach the head
- Apply the integration, contract, and consumer lenses a self-review structurally cannot
- Read each test the branch added or changed against `canon:test-craft`'s final filter, scoped to those files and never the suite
- Post the closing pass even with nothing to report, since a review left unanswered reads as one nobody closed
- State a withdrawal or a regrade on the thread with the fact that settled it, since a finding dropped in silence reads the same as one nobody answered
- Key the body file on the pull request number and the head commit, and on the response it answers once the head repeats, so no two passes overwrite each other
- Scan the comment for banned characters and internal phase labels before posting, since a finding phrased against a phase label reaches a reader with no task board
- Answer a `## For the reviewer` bullet in the body, bounded to the section itself rather than the Summary or the Technical Context around it, so the independent vantage stays clear of the author's framing

## Must not

- Merge. Review and post, and leave the gate to the human.
- Publish a claim the skill did not check. A failed fetch and a rebase both strand the prior commit, and only one of them is a rebase.
- Invent a heading beyond the two it posts and the response heading `review-address` owns, or append a number GitHub already renders
- Review local uncommitted changes
- Lecture on process. The lenses land as findings, not as asides.

## Guards

- No open pull request for the target branch: stop and route to the local review skill
- The fetch of the pull request head fails: stop rather than falling through to a full pass
- The head repeats with no response since the prior pass: stop rather than posting a body restating one the folder holds

## Out of scope

- Fixing what it finds, which `review-address` owns. The split is by side of the channel: this one posts findings from an independent session and that one consumes them.
- Reviewing local uncommitted work, which `review-branch` owns. That one writes to disk for the session that wrote the code, and this one posts to a pull request it did not write.
- Merging, which stays the human's decision
