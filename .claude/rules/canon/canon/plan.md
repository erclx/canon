---
description: Route edits under .canon/plans/ to the plan-feature skill for the plan's sections, the answer contract, and its lifecycle
paths:
  - '.canon/plans/**'
---

# Plan standards

## Plan files

- Load the `canon:plan-feature` skill before a hand edit under `.canon/plans/`. It carries the filename and slug, the required sections, and the suggested-and-answer contract for a feature plan. Report it rather than proceeding silently when the skill does not resolve.
- Never fill an `- Answer:` slot on behalf of the person who owns it. A blank slot accepts the suggestion at execution time.
- Never ship a question without a `- Suggested:` line. Write `- Suggested: needs your call, <why>` where the answer turns on preference.
- Rewrite the `- Suggested:` line as `overridden at execution to <pick>,` plus the measurement when execution deviates from an unanswered question, leaving the slot blank. Put the same deviation in one line under the open task's `## Findings`.
- Fetch the source a decision rests on and quote the passage under `**Sources:**`, or mark the entry `unverified`. Never cite an outside source from recall.
- Move a shipped plan to `.canon/plans/archive/`. Never delete one.
- Amend a plan in place when a decision changes. Do not append a second passage narrating the change.
- Follow the lifecycle the `canon:plan-feature` skill carries for when a plan is written, how it is amended, and its move to the archive.
