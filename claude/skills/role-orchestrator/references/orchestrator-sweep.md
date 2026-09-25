---
title: Orchestrator sweep runbook
description: The once-per-batch board sweep, plan re-verification, and where each merged finding goes
---

Sweep the board as orchestrator after merging. Run this once per batch of merges, before answering what to do next, because the surfaces that record what shipped are the ones nothing updates on its own.

1. Pull into the main worktree rather than fetching. A fetch leaves the local branch behind, so `git log` reports a state that has not arrived. A repository that adds a post-merge hook to name archive candidates gets it on a pull and never on a fetch.
2. Follow `orchestrator-refill.md`, every step in order. It owns the procedure. Do not restate it here and do not run it from memory.
3. Re-verify every plan already written, not only the ones this sweep writes. A queued plan goes stale from whatever merged while it waited, and the loop's verify step fires at handoff rather than after a merge, so nothing else catches it. Grep each construct the plan names and count the sites against its claim, then open each file rather than trusting its account.
4. Re-check any precondition a plan states about live state outside the repository. A remote branch, an open issue, or an installed version was true when the plan was written and is not a fact about the tree.

Run `canon worktrees list` after the pull, which is the first point at which the merges this sweep followed are readable. It owns the reclaim rule and it removes nothing, so read its rows and act on the ones you mean to. Never substitute a git ancestry check for it.

Run `canon tasks validate` once the board is rewritten and before reporting it. It resolves every plan pointer, accounts every task file against the board and the backlog both, tests the `## Run now` file sets for overlap, and re-takes the two blocker kinds a command can settle. It reports and never writes, so fix each row it names and run it again. A finding it reports is a board defect rather than a task finding, so it goes nowhere but the board.

Then run `orchestrator-parked.md` over the rows the validator listed as untested. Those carry the three blocker kinds no command settles, and the merge this sweep followed changed the tree under every one of them at once while the refill above re-read none. Take the untested rows alone rather than the whole board, since the validator already answered the rest.

Place every finding the merged work produced before promoting anything. A finding that changes a rule goes to the standard or the rule that states it, one that changes another task goes to that task's Findings, and one that overturns a groundwork lean gets marked answered in that folder. A pull request body counts as nowhere, since the thread stops being read the moment it merges.

Report what closed, what moved, and what is ready to hand a worker. Name the file set each ready task touches, so the reader can check the disjointness claim rather than take it.
