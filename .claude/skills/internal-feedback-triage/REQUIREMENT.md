---
name: internal-feedback-triage
description: Why the feedback queue is read from GitHub rather than local scratch, and why triage files measured items instead of routing or implementing
---

# Internal feedback triage requirement

## Gap

Without this skill, the feedback queue fills and nothing drains it. A local folder looks like the place to read and is the wrong one, since that scratch is per-machine and any cleanup removes it.

Triage then fails three ways. An issue routes to a fix from a paragraph, which skips the scope argument. A self-contradicting report gets a guess instead of a question. The same issue gets filed twice because two passes cannot see the board carries it.

## Must

- Read the durable queue through the `gh` CLI rather than local session scratch, and stop when it is absent or unauthenticated
- File one measured item per open issue into an intake folder, headed so an answer finds its issue, and name each skipped issue with its carrier
- Measure each claim in an issue's body and comments against the tree rather than carrying the issue's figures forward
- Claim the folder through the CLI rather than picking an ordinal by hand
- Report an empty queue as nothing open rather than widening the label to find work

## Must not

- Post to the remote, whether a comment, a close, or a label
- Implement a fix or write a plan
- Fill an answer slot, or read an empty one as agreement
- Write outside the folder it claimed

## Out of scope

- Filing new feedback, which `canon-feedback` owns
- Answering the filed items, which `plan-intake-answer` owns
- Writing the plan a plan-worthy item needs, which `plan-feature` owns
- Issues carrying any other label, which no skill here owns
