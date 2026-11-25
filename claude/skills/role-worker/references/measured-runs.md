---
title: Measured runs
description: Where a worker runs a measurement, which is never the shared machine, and what it does when the plan names a place it cannot reach
---

# Measured runs

Read this when the plan's Verification names a timing, an eval, a benchmark, or a frame rate. A worker's machine is shared with every parallel session, so a number taken there carries their builds and slows theirs.

## Where the run happens

The plan names each measured run's place as `test`, `CI`, or `operator`. Run it there and nowhere else.

- Run a `test` place through the project's test command, which holds its own fixture and bounds
- Start a `CI` place by dispatching the workflow, never by running the harness on this machine, and read the run's summary for the numbers
- Leave an `operator` place to the operator, say in the pull request that the run is owed, and name the command. Never run it as a stand-in.
- Write `not measured` with the reason in the results table for a run still owed, per `${CLAUDE_SKILL_DIR}/../git-pr/references/pr.md`

## When the place cannot be reached

Stop and ask rather than measuring beside the other sessions.

- A `CI` place with no comparison workflow in the project is a plan defect. Send the controller the gap, and build nothing in its place.
- A plan naming no place for a measured run reads as a question for the controller, since the plan check reports it and never refuses
- A local rehearsal that proves a harness runs, with its numbers left out of the pull request, is a test and not a measurement

The method that makes the numbers worth reading is in `${CLAUDE_SKILL_DIR}/../test-craft/references/measure.md`.
