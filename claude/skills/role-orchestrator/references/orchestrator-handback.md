---
title: Orchestrator handback runbook
description: The fallback for the direct channel between reviewer and worker, addressing the session that answers a posted review, the rebase handback a stale or conflicted branch earns, what to report when none is live, and where a worker's reply is placed by what it changes
---

Read this at loop step 6, once the poll reports a branch stale or conflicted, or a review pass posted anything owed that no live reviewer sent on, and the session holding that branch is to run `review-address`.

## Sending the handback

Read the threshold off `review-pr`, which states it once and governs the heading with it, so an open heading and an owed dispatch answer the same question and either one is enough to send.

- Resolve the target at sending with `canon sessions list --branch`, never from an earlier mapping, since names rotate as sessions end
- A mapping recorded earlier in a session has failed inside the hour. `orchestrator-poll.md` routes on the count and the confidence the verb answers with.
- Open the message with the worktree and branch the sender believes the reader holds, asking to be corrected, whenever that mapping is inferred
- Name the skill for the reader to run rather than writing an invocation, which arrives as text

### Reading the draft flag

Read the pull request's own draft flag rather than the state a worker reports, and report what the read returned and when rather than the state alone. `canon pr head --help` states why a reported field can lag and say nothing about it.

The flag settles the question only once the worker's chain has run its undo, and nothing marks that moment. A read taken between the pull request opening and that call sees a ready pull request about to become a draft, and once told an operator the opposite of what the worker had said.

## The rebase handback

A `STALE` or `CONFLICT` from the poll goes to the branch's own session the same way, with `review-address` as the skill to run, since its staleness test rebases a branch `main` moved under even when the merge is clean.

- Name what merged under the branch, being the pull request that landed and the files the poll listed, so the worker reads those hunks first
- Say that a check failing after a clean rebase is a semantic conflict to fix on the branch
- Say that a hunk needing a decision the tree does not carry comes back as a message rather than as a guess
- A pull request carrying review findings as well earns one message naming both, since one `review-address` run answers them together

The worker that built the branch rebases it, not this session. It holds the plan behind each hunk, and a rebase made here would also write a branch this session does not own.

## Re-review and reachability

A dispatched reviewer sends the `review-address` dispatch to the worker itself, carrying its own sessionId, and the worker sends the re-review request straight back to it. Neither leg passes through this session, which sends either one only as a fallback.

### A cloud reviewer's pass

A cloud session can send no message, and the script reports no code review posting on an unchanged head. The poll's cloud-reviewer rule reads `canon pr review-state` for each pull request a cloud reviewer holds and routes the dispatch here.

### No worker resolved

A reviewer reports that `canon sessions list --branch` returned no session or an unconfirmed match. Route it the way the poll's dispatch rule routes the count.

- On zero, launch the review-address shape in `orchestrator-launch.md`, carrying the reviewer's sessionId so the new worker answers the reviewer directly
- On an unconfirmed match, pick from a session listing and ask to be corrected, since a session may well hold the branch

### No reviewer resolved

A worker reports that the reviewer's sessionId resolved to no live session, or sends a re-review request with no reviewer named in its dispatch. Launch a fresh reviewer through the reviewer shape in `orchestrator-reviewer-launch.md`, never a pass in place, rather than messaging a name that no longer answers.

A re-review this session sends goes to the reviewer that took the first pass. Message it to re-run `review-pr` for that number alone, and launch a fresh one only when none is live.

- Find it through `canon sessions list --json` by a `reviewer-<project>-` name whose trailing numbers include the pull request's number
- Match among the trailing numbers rather than the whole name, since a batch reviewer's name lists every number it holds

### When no session is live

A session is reachable when it appears in a live listing, which reads what each session registered on disk rather than probing it. A message carries plain text and no authority.

- When no live session holds the branch, launch the review-address shape in `orchestrator-launch.md`, which enters the branch's own worktree
- Only where that launch cannot run, report the invocation for the human, naming the branch, the pull request, and the skill, then stop
- Retrying or waiting leaves the loop believing it is open while nothing acts on it

## The return leg

The channel runs both ways, and the return leg carries what the pull request cannot. A worker answering a finding by naming the plan question that already declined it changes the outcome in the moment, where a thread comment waits on its next reader.

- Read what a worker volunteers as part of the review rather than as an aside, and read a refusal the same way
- The corrections that landed on this session's model of the world arrived as a worker arguing back rather than complying
- What the worker owes on its own side is stated in `role-worker`, being the announcement, the block message, and the board ban. Do not restate it here.

### Placing a reply

What arrives does not become a record by being read, so place it by what it changes. Writing a tracked file to hold it is forbidden, which leaves the pull request and the board as the two surfaces this session writes.

- An answer settling a finding goes onto the pull request through the next pass, which withdraws or regrades it and names the fact behind it, per `review-pr`
- An answer changing what this session believes, such as a mapping correction or a constraint on a worker, settles no finding and reaches no thread
- Route that second kind the way `## Boundaries` in the skill body routes a change found while orchestrating, onto the task owning the surface it describes
