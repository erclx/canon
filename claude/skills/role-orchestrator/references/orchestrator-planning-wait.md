---
title: Orchestrator planning wait
description: How the orchestrator waits in the background on a row whose plan a planner is still writing, through canon tasks launchable, and how it branches on the record the wait ends on
---

A row whose plan a planner is still writing has nothing to dispatch yet. Run the wait in the background rather than grepping the task file on a loop, and act on the wake:

```bash
canon tasks launchable <task> --wait --json
```

The verb resolves the task's `Plan:` line and runs the `plan-answers` gate on the plan it names, re-reading every 30 seconds for up to 1800 seconds by default. It keys on the line rather than the plan file. A planner links a plan only after it validates, so a half-written plan never wakes the loop.

## Branch on the record

Branch on the record's `reason` rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

- `launchable`: the plan waits on nobody, so run `${CLAUDE_SKILL_DIR}/references/orchestrator-dispatch.md` from the candidate on, since the wait never reads the branch or the conflict check
- `timeout`: read `plan` and `open` off the last reading, then act on which one held the row
  - No `plan` means nothing was linked in time, so check the planner is still live and re-arm the wait
  - A non-empty `open` names the questions holding the row, so report each label and reason to the operator, then re-arm the wait
- A refusal such as `several-plans`, `archived`, or `no-match` means the row cannot launch as it stands, so name the reason and fall back to the human

A one-shot read without `--wait` reports `reason: unlinked`, `open`, or `launchable` at once. It suits a pass that only needs the row's state now.
