---
name: canon-feedback-triage
description: Why the feedback queue is read from GitHub rather than local scratch, and why triage files measured items instead of routing or implementing
---

# Canon feedback triage requirement

## Gap

Without this skill, the feedback queue fills and nothing drains it. Reports arrive from projects the toolkit never sees, and a queue nobody reads on a schedule is the same as no queue. A local folder looks like the right place to read, and it is the wrong one, because that content is per-machine session scratch that any cleanup removes.

Triage fails three ways once it starts. An issue gets routed straight to a fix from a paragraph of description, which skips the step where scope is argued and the operator's call. An issue whose report contradicts itself gets a guess rather than a question, so the fix addresses a defect nobody confirmed. And the same issue gets filed twice, because two passes cannot see that the board already carries it.

## Must

- Read the durable queue rather than local session scratch
- File one measured item per open issue into an intake folder, headed so an answer finds its issue
- File every open issue the board does not already carry, and name each skipped issue with its carrier
- Measure each claim against the tree rather than carrying the issue's figures forward
- Claim the folder through the CLI rather than picking an ordinal by hand

## Must not

- Post to the remote, whether a comment, a close, or a label
- Implement a fix or write a plan, which the answered item routes to
- Fill an answer slot, or read an empty one as agreement
- Write outside the folder it claimed

## Guards

- The `gh` CLI absent or unauthenticated stops, since the queue is unreachable
- An empty queue reports nothing open rather than widening the label to find work

## Out of scope

- Filing new feedback: `canon-feedback`
- Answering the filed items: `plan-intake-answer`
- Writing the plan a plan-worthy item needs: `plan-feature`
- Triage of issues carrying any other label, which surface here by design only under the feedback label
