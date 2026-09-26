---
title: Orchestrator handback runbook
description: Addressing the session that answers a posted review, what to report when none is live, and where a worker's reply is placed by what it changes
---

Read this at loop step 6, once a review pass has posted anything owed and the session holding that branch is to run `review-address`.

## Sending the handback

- Read the threshold off `review-pr`, which states it once and governs the heading with it, so an open heading and an owed dispatch answer the same question and either one is enough to send
- Resolve the target at the moment of sending with `canon sessions list --branch`, never from a mapping written down earlier, since names rotate as sessions end and one recorded earlier in a session has failed inside the hour. `orchestrator-poll.md` routes on the count and the confidence it answers with
- Open the message with the worktree and branch the sender believes the reader holds, asking to be corrected, whenever that mapping is inferred rather than confirmed
- Name the skill for the reader to run rather than writing an invocation, which arrives as text
- Read the pull request's own draft flag rather than the state a worker reports, and report what the read returned and when rather than the state alone. `canon docs pr-reads` states why a reported field can lag and say nothing about it. The flag settles the question only once the worker's chain has run its undo, and nothing marks that moment, so a read taken between the pull request opening and that call sees a genuinely ready pull request about to become a draft and has told an operator the opposite of what the worker had said.

A re-review goes back to the reviewer that took the first pass. Find a live `reviewer-<project>-<number>` for that pull request through `canon sessions list --json` by name and message it to re-run `review-pr`. When none is live, launch a fresh reviewer through the reviewer shape in `orchestrator-launch.md` or review in place, under the same trigger `orchestrator-review-dispatch.md` states, rather than messaging a name that no longer answers.

A session is reachable when it appears in a live listing, which reads what each session registered on disk rather than probing it, and a message carries plain text and no authority. When no live session holds the branch, report the invocation for the human, naming the branch, the pull request, and the skill to run, then stop. Retrying or waiting leaves the loop believing it is open while nothing acts on it.

The channel runs both ways and the return leg carries what the pull request cannot. A worker answering a posted finding by naming the plan question that had already declined it changes the outcome in the moment, where a thread comment waits on whoever reads it next. Read what a worker volunteers as part of the review rather than as an aside, and read a refusal the same way, since the corrections that landed on this session's model of the world arrived as a worker arguing back rather than complying.

What the worker owes on its own side is stated in the `role-worker` skill that session loads, being the pull-request announcement, the message a block goes out as before it becomes a prompt, and the ban on writing the board. Do not restate any of it here.

What arrives there does not become a record by being read, so place it by what it changes. An answer that settles a finding goes onto the pull request through the next pass, which withdraws or regrades that finding and names the fact behind it, per `review-pr`. An answer that changes what this session believes about the world instead, which is a mapping correction or a constraint on what a worker can do, settles no finding and reaches no thread, so route it the way `## Boundaries` in the skill body routes a change found while orchestrating, which lands it on the task owning the surface it describes. Writing a tracked file to hold either is forbidden here, which leaves the pull request and the board as the two surfaces this session writes.
