---
description: Route edits under .canon/plans/ to the plan-feature skill, and keep the five hand-edit floors a plan breaks silently
paths:
  - '.canon/plans/**'
---

# Plan standards

## Plan files

- Load the `canon:plan-feature` skill before a hand edit under `.canon/plans/`, whose references own its shape and lifecycle. Report it rather than proceeding silently when it does not resolve.
- Never fill an `- Answer:` slot on behalf of the person who owns it. A blank slot accepts the suggestion at execution time.
- Rewrite an unanswered question's `- Suggested:` line as `overridden at execution to <pick>,` plus the measurement when execution deviates, leaving the slot blank.
- Fetch the source a decision rests on and quote the passage under `**Sources:**`, or mark the entry `unverified`. Never cite an outside source from recall.
- Move a shipped plan to `.canon/plans/archive/`. Never delete one.
- Amend a plan in place when a decision changes. Do not append a second passage narrating the change.
