---
name: issue-triage
description: Why a repository's open issues are filed as measured intake items rather than routed or fixed from the issue text, and why one pass is capped
---

# Issue triage requirement

## Gap

Without this skill, a repository's issue queue fills and nothing drains it into decisions. An issue reads as a request, so a session routes it straight to a fix from a paragraph and skips the scope argument.

Triage done by hand fails three ways. A self-contradicting report gets a guess instead of a question. The same issue gets filed twice because two passes cannot see the board carries it. A queue of hundreds files in one pass that no answering session can get through.

## Must

- Read the queue through the `gh` CLI, and stop when it is absent, unauthenticated, or the checkout has no GitHub repository
- File one measured item per kept issue into a folder the CLI claimed, headed so an answer finds its issue, and name each skipped issue with its carrier
- Measure each claim in an issue's body and comments against the tree rather than carrying the issue's figures forward
- Cap one pass, oldest first, and name what was left over rather than reading a capped queue as drained
- Report an empty queue as nothing open rather than widening the label to find work

## Must not

- Post to the remote, whether a comment, a close, or a label
- Implement a fix or write a plan
- Fill an answer slot, or read an empty one as agreement
- Write outside the folder it claimed
- Carry a step only one repository's queue needs, such as stripping a reporting project's specifics, since a caller wrapping this skill adds those around it

## Out of scope

- Opening a new issue, which `git-issue` owns
- Answering the filed items, which `plan-intake-answer` owns
- Writing the plan a plan-worthy item needs, which `plan-feature` owns
- Pruning the task backlog, which `backlog-triage` owns
