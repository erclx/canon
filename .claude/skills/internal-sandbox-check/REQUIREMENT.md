---
name: internal-sandbox-check
description: Scope boundary for the ship-time pairing audit, and what separates a run that verified something from one that returned green
---

# Internal sandbox check requirement

## Gap

Without this skill, a branch ships a changed skill whose scenario exercises the old body. A run measures an arm nobody chose, provisions against the main checkout from a worktree, or destroys one scenario by provisioning a second beside it. Each returns green, so the branch carries a receipt for something it never changed.

The audit also re-asks what is answered. A skill the census ruled on draws a prompt on every branch, since the answer reaches nothing durable, and one word covers both deferring a run and ruling that no arm should exist. An item ships unverified with no record of what stopped it.

## Must

- Every changed skill and script is paired to a scenario or an explicit opt-out and carries a printed status, with the arm and gate resolved before the report
- The run uses the worktree-local entry point, provisions one scenario, and queues the rest
- An item shipping without a live run names exactly one gate
- A census verdict is reported rather than re-asked, and a scenario at a path no spelling reaches is offered rather than recorded
- A verdict, an internal skill outside the census, and an answer given this run carry separate labels

## Must not

- Guess a pairing past the first fallback, or an arm from the scenario file
- Read `unchecked` as a pass or as a failure
- Open an interactive session, or sweep the queued scenarios through the runner
- Propose or apply a scenario edit, or fix a failing verdict
- Write an exemption

## Out of scope

- Authoring, extending, or running a scenario during development, which `internal-scripts` owns
- Whether the changed behavior is correct, which `review-pr` owns
