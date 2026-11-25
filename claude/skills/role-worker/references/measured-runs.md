---
title: Measured runs
description: Where a worker runs a measurement, which is never the shared machine, and what it does when the plan names a place it cannot reach
---

# Measured runs

Read this when the plan's Verification names a timing, an eval, a benchmark, or a frame rate. A worker's machine is shared with every parallel session, so a number taken there carries their builds and slows theirs.

## Where the run happens

The plan names each measured run's place as `test`, `CI`, or `operator`. Run it there and nowhere else.

- Run a `test` place through the project's test command, since it asserts a count or a score and no timing
- Start a `CI` place by dispatching the workflow, never by running the harness on this machine, and show the run as `## Showing the run` states
- Leave an `operator` place to the operator, never run it as a stand-in, and name the command in the pull request. Report the run as optional unless the plan requires it.

## Showing the run

A run takes long enough that the person waiting wants to open it, so its link reaches chat and the controller the way a pull request does.

- Read the run's address once it is dispatched, through `gh run list --workflow <file> --event workflow_dispatch --limit 1 --json url,displayTitle`, checking the title names this branch
- Print the address on its own line, and send it to the controller with what it measures
- Write the results row with `pending` in Result and the linked run in Conditions
- On the result, fill the row and keep the link, put the headline in the second sentence of Summary, print the address again beside the numbers, and ask the controller to run the lift
- Write `not measured` with the reason where a run was cancelled or nothing can time it, since a pending row holds the merge

## When the place cannot be reached

Stop and ask rather than measuring beside the other sessions.

- A `CI` place with no comparison workflow in the project is a plan defect. Send the controller the gap, and build nothing in its place.
- A plan naming no place for a measured run reads as a question for the controller, since the plan check reports it and never refuses

The method that makes the numbers worth reading is in `${CLAUDE_SKILL_DIR}/../test-craft/references/measure.md`.
