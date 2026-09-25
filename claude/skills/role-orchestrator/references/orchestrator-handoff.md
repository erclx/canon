---
title: Orchestrator handoff runbook
description: Retirement act the wind-down owes the fleet it dispatched, the two sections an orchestrating session adds over the shared session map, how capture runs from a session that never commits, and the resume invocation the file carries out
---

## Retire what the wave delivered

Settle this act before writing the map. A session retired afterwards is one the map already listed as running, and the map is what the next session reads the fleet off.

The act reaches every session this one dispatched that no verb can decide. `canon worktrees reclaim` refuses a directory on any of seven conditions and reclaims one that trips none, and three of the seven are what this act turns on: a merged pull request, a clean tree, and no live session holding the directory. A running session trips the third whatever its branch did, and retiring it is what clears that one, which is why the retirement runs ahead of the reclaim rather than after it.

Two cases stay undecided even once the session is gone. A worker whose branch has not merged is refused on `no-merged-pull-request`, and a planner is refused as `main-worktree` and handed a null removal route, since it never enters a worktree and registers against the tree it was launched from.

Name the planner as the case always in this set, and scope the act no narrower. A rule covering planners alone leaves the unmerged worker unreached while reading as complete.

### Which sessions this session may retire unasked

Retire what this session dispatched. Report a hand-launched session and leave the act to the operator, since the knowledge making the act safe is a delivery this session received and it received nothing from a session it never launched. The `worker-` and `planner-` name prefixes separate the two populations, per `orchestrator-dispatch.md`.

A capability gap sits beside the knowledge gap, and it holds even where delivery is somehow known. A hand-launched session is as often interactive as background, and `claude rm <id>` has no id to take for an interactive one at all, so the command cannot reach it whatever this session learned about its delivery.

### Telling a delivered session from a blocked one

No status field carries the difference. `status` reads `busy` or `waiting` straight off the client record, and both describe the last turn rather than the work, so `waiting` is the ordinary answer for a session that reported and stopped, which is what a correct delivery looks like. The `statusDwellMs` beside it separates a long idle from a short one and separates nothing else.

The read is the report this session is holding. Retire a session whose delivery arrived here, and leave every other one. A plan sitting at `.canon/plans/feature-<slug>.md` corroborates that report and never stands in for it, because a planner writes the file and can then stop on a follow-up question with the file already landed. Retiring a blocked session destroys the context it held and nothing on disk records what it had read, so the act runs in the keeping direction the reclaim reading already takes: retire what is recorded as delivered, and leave the rest for the operator.

### The act, and the order it runs in

`claude rm <id>` is meant to remove a background session and its worktree together, though its own report is not reliable, so `canon worktrees list` is the reading to trust afterward. It takes one target per call, so a wave costs one call per session. The argument is the id rather than the name, which `claude agents --json` carries beside the name on every row, so a session read off a roster by name is matched to its id there before the call. The name form answers `No job matching`.

The command belongs to the client rather than to this toolkit, so a target running another client performs whatever removal that client offers.

Run `canon worktrees reclaim` after the retirements rather than before them. `held-by-session` is one of the conditions that reading refuses on, so a reclaim taken first refuses the directories the retirement is about to free and reports a board with nothing left to do.

Report the retired sessions as a list, the hand-launched ones under it as a read rather than an act, and what the reclaim removed below both.

## Write the map

Write the pre-compaction handoff as orchestrator. Invoke `canon:session-map` for the generic half, which is the filename, the three core sections, the write procedure, the drift step and the ref it reads, and the citation rule. Everything in this section is the extension this role adds over that core, and none of it belongs to a session holding no delegated authority.

Settle all three steps below before the door writes, so one write carries the core and the extension together. The door reports the map as written and knows nothing of this role, so its success line ends the generic half rather than this runbook, and a session that stops there ships a map missing both of the things this section adds to it.

1. Tell the door this session does not commit, which is the caveat its capture step takes and passes to `canon:memory-capture`.
2. Add `## Decisions taken under delegated authority` directly after `## State`, holding each decision and why it went that way, so nobody re-proposes it. It sits there rather than after the core because a decision is read against the state it was taken in.
3. Close the file with the block below, resolving `${CLAUDE_SKILL_DIR}/references/orchestrator-resume.md` and `${CLAUDE_SKILL_DIR}/references/orchestrator-poll.md` to absolute paths as you write it and pasting each in place of `<RESUME_RUNBOOK>` and `<POLL_RUNBOOK>`:

```markdown
Resume by loading the orchestrator skill and asking it to resume after a compaction. This repository spells that `/canon:role-orchestrator` followed by the request. Following <RESUME_RUNBOOK> reaches the same place with no skill loaded at all.

That resume reads the board and stops. It restarts nothing, so the review poll is a second thing owed here, and <POLL_RUNBOOK> holds the prompt and the condition. Do not reach for `session-resume`, which reads tracked work and reports the newest map without restarting this loop.
```

The delegated-authority section is the orchestrator's alone because a worker holds no delegation to have exercised, and a section a session cannot fill teaches its reader to skip the file. The closing block is the orchestrator's for the same reason from the other direction: it restarts a review poll no other role runs.

The substitution belongs in step 3 because that step ends the write. A reader who treats the list as finished elsewhere ships the literal placeholders, and the variable expands while this runbook renders rather than in the turn that reads the handoff back, so a path left unresolved reaches a session holding no skill as a string matching nothing. `orchestrator-poll.md` resolves its script at the same point and for the same reason.

That block sits in this runbook and again in the file this runbook writes, which is the fix rather than a copy for a later pass to collapse. A session has to already be holding this runbook to read it, and a compaction that took the skill body took the routing to it too, so the session that most needs the resume is the one that can no longer find it. The map survives that, so it carries the invocation itself. Each of the two reaches a reader the other cannot.

The requirement is a resume request to the orchestrator skill with that skill loaded first. The command the block carries is this repository's spelling rather than the only one, since the skill ships to every target holding the plugin and each runs whatever client it runs. The poll restart is named beside it because the resume performs none.

Step 1 exists because both other callers of capture are ship-chain skills and this session never ships. Without a call here, the session that receives every operator correction is the one session that records none. A compaction arriving with no warning takes the capture with it, and firing it once per batch of merges leaves the same window open across a long planning stretch, since a sweep runs only on a merge. The refill sweep reports the debt between handoffs so the operator knows one is owed.

Step 1 varies the door rather than replacing it, which is why the door is invoked first and this runbook states only what differs. The generic half moved out whole, the drift step and its ref recovery with it, so nothing here restates a step the door already carries and the two cannot disagree.

Capture is told this session does not commit, so it skips routing and writes memory files alone. A routed fact lands in a context entry, which is a tracked file, and the orchestrator's boundaries forbid writing one from this session. That split is correct rather than a limitation, since a domain fact belongs to the task that owns the surface and goes in that task's Findings, while what this session produces is feedback about how to work.
