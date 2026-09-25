---
title: Orchestrator review fallback runbook
description: What moves out of this session when a diff is too large or three pull requests await a first pass, why only the narrow re-review dispatches, and what its launch has to say
---

Run this when `### The review fallback` in the skill body trips, on a diff too large for this session to hold or on three or more open pull requests awaiting a first pass. Either one makes review the bottleneck every track is waiting on, and both answer the same way: dispatch the narrow re-review and keep the first pass here.

## The count

Three is the operator's number, set by hand and marked as such so a measurement replaces it rather than argues with it. What counts toward it is a pull request awaiting a first pass rather than every open one, since a branch already closed out and waiting on a merge costs this session nothing and counting it would fire the switch on a queue that is clear. `orchestrator-poll.md` states where the count is legible.

Nothing counts the pull requests. This is prose this session applies to itself, on the same standing as the poll's own start condition, so a wave past three reviewed one at a time is a rule that went unread rather than a check that failed.

## What dispatches

Only the narrow re-review dispatches. A first pass reads across branches, and the findings that pay for its cost are the ones no single pull request shows: two branches regenerating one binary asset for the same count, three writing one context entry, a merge order making one branch's figure true only after another lands. A re-review asks whether the prior findings landed and whether the fix regressed anything, which is bounded to a delta and carries none of that reading, so it is the half that leaves cleanly.

What it dispatches has no role skill yet. `role-worker` and `role-planner` each state what their session may not do and no third body states a reviewer's, so a dispatched re-review would hold its obligations in whatever launch string this session types. Write the third after the first trial rather than before it, since a body written ahead of any dispatched reviewer encodes a shape nobody has driven. Until it exists, say in the launch itself that the pass is bounded to the delta and that the cross-branch reading stays here.
