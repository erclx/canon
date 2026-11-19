---
name: session-retro
description: Why a session's toolkit friction is sorted by a fixed filter before anything is filed, and where filing stays
---

# Session retro requirement

## Gap

Without this skill, deciding what a session's friction is worth filing is rebuilt by hand each time. The operator asks in several wordings, and the session re-argues the same filter in prose, asking whether a cost was observed, whether the toolkit or the project caused it, whether it is already filed, and whether it was a slip.

A session asked for candidates lists volume over value, files a repeat of an open issue as new, or sends project friction to the toolkit.

## Must

- Propose only a candidate passing the six fixed tests, showing every dropped one with the test that dropped it
- Match each candidate against the open feedback issues through the CLI, so a repeat becomes a follow-up, and say so when the match did not run
- Cap the shortlist at five, ranked by observed cost, and propose nothing when the session holds no toolkit friction
- File only the operator's picks, each through `canon-feedback`

## Must not

- Run on its own, at a handoff, or at a compaction. Only the operator invokes it, so nothing else ever does, and a review weighs whether that still earns a catalog entry.
- Probe the project or toolkit surfaces to find or enrich a candidate
- Post an issue or a comment itself

## Out of scope

- Building and sending one report, which `canon-feedback` owns
- Placing a project row on the board, which `task-board` owns
- Draining the toolkit's feedback queue, which the toolkit's maintainers do
