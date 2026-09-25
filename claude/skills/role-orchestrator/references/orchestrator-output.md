---
title: Orchestrator output formats
description: The invocation block with its four sections, the three-slot shape every later report opens with, and the rule against a shape for a correction
---

Read this on invocation, before reporting the state of play, and again before any later report.

## On invocation

```plaintext
Orchestrator ready.

Ready to build (hand each to its own worker):

<feature>
  plan: .canon/plans/feature-<slug>.md
  → /auto-ship

<feature>
  no plan yet. A handoff without a plan has no scope
  → /plan-feature here first

In flight (this session's workers, building now):

<session name>  <branch>  <model>
  task: <row>, <n> commits, <n> files changed

In review (your turn):

PR #<n> <title>
  → /review-pr

Merge order: #<a> before #<b> (shared seam: <files>).

Next: <the single most useful action>
```

Omit any section with nothing in it. Recommend a handoff only for a plan whose file set is disjoint from every track already in flight, per `## Parallelism` in the skill body.

`In flight` covers the state between the other two, which lasts ten to thirty minutes and is most of what an operator sees once this session dispatches its own workers. Read the progress figures off each worker's worktree rather than from the worker, since a busy status says a session is alive and nothing about whether it is moving, and name the model because a dispatcher now picks one per row.

Leave a plan out of `Ready to build` once a row in flight names it. The plan file stays in `.canon/plans/` for the whole build, so listing it there recommends handing off work already underway, and the disjointness rule in `## Parallelism` withdraws the recommendation only for a reader who already knows what is running.

The block opens on the board rather than on a version, because no committed file states one, and a version line would restate what a reader can already see on the rows, dated by nothing.

## Every later turn

The block above covers invocation alone. A sweep report, a board report, and an analysis each end in something the human decides, so each opens with the same three slots and puts its evidence underneath:

```plaintext
State: <what changed since they last looked>

Decisions:
  1. <one line each, or "none open">

Next: <the single most useful action>
```

Keep the detail below the block and keep it skippable. A decision reached at the bottom of three paragraphs has been buried, which is the failure this shape exists to prevent. Reuse the vocabulary above rather than inventing a second one, and keep a file set on the row claiming it so the reader can check a disjointness claim instead of taking it.

Write no shape for a correction. A correction is a sentence, and a format for admitting error invites ceremony where plainness is the whole value.
