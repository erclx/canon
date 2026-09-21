---
name: canon-feedback-triage
description: Why the feedback queue is read from GitHub rather than local scratch, and why triage routes instead of implementing
---

# Canon feedback triage requirement

## Gap

Without this skill, the feedback queue fills and nothing drains it. Reports arrive from projects the toolkit never sees, and a queue nobody reads on a schedule is the same as no queue. The local review folder looks like the right place to read, and it is the wrong one, because that content is per-machine session scratch that any cleanup removes.

Triage fails three ways once it starts. Unrelated issues get batched into one branch, so review has to judge several unconnected changes at once and can approve none of them cleanly. An issue needing a plan gets implemented inline from a paragraph of description, which skips the step where scope is argued. And an issue whose report contradicts itself gets a guess rather than a question, so the fix addresses a defect nobody confirmed.

The queue also fails to drain even when the work ships. A fix merged with no link back leaves its issue open, and the next triage re-reads work already done.

## Must

- Read the durable queue rather than local session scratch
- Classify each issue in a fixed order and stop at the first match, stating the class and its one-line reason before routing
- Route to the skills that own planning, branch naming, and the pull request body rather than restating them
- Keep one issue to one branch and one pull request
- Link a fix to its issue so merge closes it, and preserve that link when the body is regenerated
- Ask on the issue when the report is unreadable, then move on rather than blocking the batch

## Must not

- Batch unrelated fixes into one branch
- Implement a plan-worthy issue, which stops at the plan handed back to the user
- Close an issue whose pull request has yet to merge

## Guards

- The `gh` CLI absent or unauthenticated stops, since the queue is unreachable
- An empty queue reports nothing open rather than widening the label to find work

## Out of scope

- Filing new feedback: `canon-feedback`
- Writing the plan a plan-worthy issue needs: `plan-feature`
- Triage of issues carrying any other label, which surface here by design only under the feedback label
