---
title: The pull request draft lift
description: The decision canon pr lift reverses about who lifts a draft mark, its gate order and re-read, and why the cloud reviewer cannot lift
---

# The pull request draft lift

## Decisions

### The decision it reverses

`canon pr lift` reverses a rule the orchestration rules had settled the other way, that only the controlling session lifts a pull request's draft mark. A reviewer or worker cannot tell a real request to lift from a message that only claims to come from the controller, so the sender had to be the one that acts.

### A verb reads the gate itself

That removes the sender from the question. Review state at the head, UI state where a checklist exists, the evidence check, the standing against the base, and CI are all facts on the pull request, so the session closing a review can run it and the claim of who asked stops mattering.

### The controller stays the fallback

Two reviewers closing seconds apart can each read the other as open and both refuse. The final re-read narrows that window without closing it, so the controller remains the fallback lifter.

### Gate order and re-read

`src/pr/lift.ts` reads review state, UI state, evidence, and standing ahead of the CI wait, so a reviewer whose partner is still driving refuses at once.

It reads the head and the reviews again before the write, since a push during the wait moves the head off the commit every gate cleared. A review pass carrying no read-time marker refuses `review-unmarked`, because its covered commit is the submission stamp the marker replaced.

### The base-standing read has two copies

It is ported from the orchestrator poll's `readMerges`, `readWritten`, and `readStale` into `src/pr/lift.ts`, so two copies sit on two release cadences, the drift `pr.md` already warns of for the review marker.

Delegating the poll to `canon pr lift --check` is the way to one authority, and it lands with the routing change that edits the poll.

### The evidence and UI gates

The evidence gate shells this checkout's own `canon pr evidence --check --json` rather than restating the check, and the UI gate branches on that record's `checklist` field.

### The write

The write is the one GraphQL call under `pr`, `markPullRequestReadyForReview`, since the REST pull request update carries no draft field. It reads `isDraft` back from the answer.

A cloud reviewer's proxy refuses GraphQL, so it cannot lift and hands the pull request to the controller.
