---
title: Orchestrator handoff runbook
description: Retirement act the wind-down owes the fleet it dispatched, the talk sessions it exempts, the three sections an orchestrating session adds over the shared session map, where a lesson goes from a session that never commits, and the resume invocation the file carries out
---

## Retire what the wave delivered

Settle this act before writing the map. A session retired afterwards is one the map already listed as running, and the map is what the next session reads the fleet off.

The act reaches every session this one dispatched that no verb can decide. `canon worktrees reclaim` refuses a directory on any of seven conditions, and three are what this act turns on, being a merged pull request, a clean tree, and no live session holding the directory.

- A running session trips the third whatever its branch did, and retiring it clears that one, so the retirement runs ahead of the reclaim
- A worker whose branch has not merged stays undecided once gone, refused on `no-merged-pull-request`
- A planner stays undecided too, refused as `main-worktree` with a null removal route, since it registers against the tree it was launched from
- Name the planner as the case always in this set, and scope the act no narrower, since a rule for planners alone leaves the unmerged worker unreached

### Which sessions this session may retire unasked

Retire what this session dispatched. Report a hand-launched session and leave the act to the operator, since what makes the act safe is a delivery this session received, and it received nothing from a session it never launched.

- The `worker-` and `planner-` name prefixes separate the two populations, per `orchestrator-launch.md`
- A capability gap sits beside that knowledge gap. A hand-launched session is often interactive, and `claude rm <id>` has no id to take for one.

### Talk sessions

A talk session is the exception inside the dispatched population. Retire it only on the operator's word, given here or carried in the session's own close message, and never on its delivery, at wind-down or any other point.

- Its plan landing or its pull request opening tells this session nothing about whether the conversation is over
- Until the word arrives, report it as held open next to the hand-launched read
- Find it by the `sessionId` the prior map records or this session's launch output carries, since the client can rename it and drop the `-talk` suffix

### Telling a delivered session from a blocked one

No status field carries the difference. `status` reads `busy` or `waiting` off the client record, both describing the last turn rather than the work, so `waiting` is the ordinary answer for a session that reported and stopped. `statusDwellMs` separates a long idle from a short one and nothing else.

The read is the report this session is holding. Retire a session whose delivery arrived here, and leave every other one for the operator.

- A plan at `.canon/plans/feature-<slug>.md` corroborates that report and never stands in for it, since a planner can stop on a question after writing it
- Retiring a blocked session destroys its context and nothing on disk records what it had read, so the act keeps, as the reclaim reading does

### The act, and the order it runs in

`claude rm <id>` is meant to remove a background session and its worktree together, though its own report is not reliable, so trust `canon worktrees list` afterward. It takes one target per call, so a wave costs one call per session.

- The argument is the id, which `claude agents --json` carries beside the name on every row, and the name form answers `No job matching`
- The command belongs to the client, so a target running another client performs whatever removal that client offers
- Run `canon worktrees reclaim` after the retirements, since it refuses on `held-by-session` and a reclaim taken first finds nothing left to do
- Report the retired sessions as a list, the hand-launched ones under it as a read rather than an act, and what the reclaim removed below both

## Write the map

Write the pre-compaction handoff as orchestrator. Invoke `canon:session-map` for the generic half, being the filename, the three core sections, the write procedure, the drift step and the ref it reads, and the citation rule. Everything in this section is the extension this role adds.

Settle all three steps below before the door writes, so one write carries the core and the extension together. The door's success line ends the generic half rather than this runbook, so a session stopping there ships a map missing everything this section adds.

1. Add `## Decisions taken under delegated authority` directly after `## State`, holding only the rules and holds this session set that die with the wave.
   - End each with `(until <event>)`, naming what retires it, so the next session re-tests it rather than obeying it
   - Write `None.` when nothing is still in force
   - It sits there because a decision is read against the state it was taken in
2. Add `## Talk sessions held open` directly after that, one line per open talk session giving its name, its `sessionId`, and its row, or `None.`.
   - The next session reads it to know which sessions it must not retire on a delivery
3. Close the file with the block below under a `## Resume` heading, resolving each runbook path to an absolute one as you write it.
   - The heading is what keeps the block out of the map's word count
   - Paste `${CLAUDE_SKILL_DIR}/references/orchestrator-resume.md` resolved in place of `<RESUME_RUNBOOK>`
   - Paste `${CLAUDE_SKILL_DIR}/references/orchestrator-poll.md` resolved in place of `<POLL_RUNBOOK>`

```markdown
## Resume

Resume by loading the orchestrator skill and asking it to resume after a compaction. This repository spells that `/canon:role-orchestrator` followed by the request. Following <RESUME_RUNBOOK> reaches the same place with no skill loaded at all.

That resume reads the board and stops. It restarts nothing, so the review poll is a second thing owed here, and <POLL_RUNBOOK> holds the prompt and the condition. Do not reach for `session-resume`, which reads tracked work and reports the newest map without restarting this loop.
```

### What the decisions section leaves out

A decision is in force or it is history, and only the first changes what the next session does.

- Drop a finished act, such as a merge taken, a session retired, or a row placed. Version control, the board, and the roster already carry it.
- Route a rule that outlives the wave per `## Where a lesson goes` below, since a standing rule left in the map is obeyed after its reason is gone
- Keep a hold this session placed on a row or a session, with the event that lifts it

### Why these sections are the orchestrator's

The delegated-authority section is the orchestrator's alone because a worker holds no delegation to have exercised, and a section a session cannot fill teaches its reader to skip the file. The closing block is the orchestrator's because it restarts a review poll no other role runs.

- The substitution sits in step 3 because that step ends the write
- The variable expands while this runbook renders, never when the handoff is read back
- A path left unresolved reaches a session holding no skill as a string matching nothing. `orchestrator-poll.md` resolves its script at the same point.

### Why the block appears twice

That block sits here and again in the file this runbook writes, which is the fix rather than a copy to collapse. A compaction that took the skill body took the routing to this runbook too, so the map carries the invocation itself, and each copy reaches a reader the other cannot.

- The requirement is a resume request to the orchestrator skill with it loaded first, and the command shown is this repository's spelling, not the only one
- The poll restart is named beside it because the resume performs none
- This runbook varies the door rather than replacing it, stating only what differs, so the two cannot disagree

## Where a lesson goes

This session commits nothing, and the orchestrator's boundaries forbid writing a context entry from it. A domain fact goes in the Findings of the task owning the surface, and so does a lesson about how to work, since nothing reads a lesson left only in the map once the next session is past it.
