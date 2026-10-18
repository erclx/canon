---
title: Orchestrator sweep runbook
description: The once-per-batch board sweep, plan re-verification, and where each merged finding goes
---

Sweep the board as orchestrator after merging. Run this once per batch of merges, before answering what to do next, because the surfaces that record what shipped are the ones nothing updates on its own.

1. Pull into the main worktree rather than fetching, since a fetch leaves the local branch behind and `git log` reports a state that has not arrived.
   - A repository that adds a post-merge hook to name archive candidates gets it on a pull and never on a fetch
2. Follow `orchestrator-refill.md`, every step in order. It owns the procedure. Do not restate it here and do not run it from memory.
3. Re-verify every plan already written, not only the ones this sweep writes.
   - A queued plan goes stale from whatever merged while it waited, and the loop's verify step fires at handoff, so nothing else catches it
   - Grep each construct the plan names and count the sites against its claim, then open each file rather than trusting its account
4. Re-check any precondition a plan states about live state outside the repository, such as a remote branch, an open issue, or an installed version.
   - Each was true when the plan was written and is not a fact about the tree

## Worktrees and the validator

Run `canon worktrees list` after the pull, the first point at which the merges this sweep followed are readable. It owns the reclaim rule and removes nothing, so read its rows and act on the ones you mean to. Never substitute a git ancestry check for it.

Run `canon tasks validate` once the board is rewritten and before reporting it. It reports and never writes, so fix each row it names and run it again.

- It resolves every plan pointer and accounts every task file against the board and the backlog both
- It reports the paths `## Run now` rows share as a candidate list for the conflict check, and re-takes the two blocker kinds a command can settle
- A finding it reports is a board defect rather than a task finding, so it goes nowhere but the board

### Untested rows

Then run `orchestrator-parked.md` over the rows the validator listed as untested. Those carry the three blocker kinds no command settles, and the merge changed the tree under every one at once while the refill re-read none. Take the untested rows alone, since the validator already answered the rest.

## Place the findings

Place every finding the merged work produced before promoting anything. A pull request body counts as nowhere, since the thread stops being read the moment it merges.

- A finding that changes a rule goes to the standard or the rule that states it
- One that changes another task goes to that task's Findings
- One that overturns a groundwork lean gets marked answered in that folder

Report what closed, what moved, and what is ready to hand a worker. Name the file set each ready task touches and the hold or shared paths it carries, so the reader can check the conflict call rather than take it.
