---
name: review-pr
description: What the independent pull request review is for, the gaps it closes, and why it posts until nothing is open
---

# Review PR requirement

## Gap

Without this skill, a pull request is reviewed only by the session that wrote it, which cannot see a sibling branch in flight. Findings land in chat and leave the thread with no record. A review that opens and never closes is worse than none, since a reader cannot tell an unanswered review from a confirmed one.

A finding also stops being true by argument rather than by a fix, and dropping it silently reads like one everyone forgot. A `## For the reviewer` request reaches no reader unless this side reads it. Scoping a later pass off GitHub's review stamp skips real work, since the stamp follows an author's push onto a commit the pass never saw.

## Must

- Passes post until the review closes, with the heading set from the finding count so the latest comment reports whether anything is open
- The pass is detected from the thread by heading equality, and a later pass covers only the commits since the prior one, once that commit is confirmed to still reach the head
- The review applies the integration, contract, and consumer lenses, `review-craft`'s axes and evidence bar, and `test-craft`'s filter over the tests the branch changed
- A withdrawal or regrade is stated on the thread with the fact that settled it, and a `## For the reviewer` bullet and each `**Review focus:**` item are answered
- The body file is keyed on the number, the head, and the response it answers, and the comment is scanned for banned characters and phase labels before posting

## Must not

- Merge, which stays the human's decision
- Review local uncommitted changes, or run without an open pull request
- Publish a claim it did not check, or fall through to a full pass when the head fetch fails or the head repeats with no response
- Invent a heading beyond the two it posts and the one `review-address` owns
- Lecture on process, since the lenses land as findings

## Out of scope

- Fixing what it finds, which `review-address` owns
- What a review looks for and how much evidence a finding needs, which `review-craft` owns
- Which layer a test belongs at, which `test-craft` owns
