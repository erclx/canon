---
name: plan-feature
description: What feature planning is for, the gaps it closes, and why it stops before implementing
---

# Plan feature requirement

## Gap

Implementation starts before anyone knows what it touches. A session rediscovers a settled constraint halfway through, and an ambiguity gets resolved silently in whichever direction the first edit went. A feature stacked into pull requests over the same files pays the review cost once per slice.

A constraint naming a surface to leave alone forbids two acts at once, conforming it and retargeting a pointer into it. A vague ask reaches the plan with no checkable criterion, and a decision rests on a practice recalled from memory.

## Must

- Read the project's Claude setup and the domain's context entry, run the existing thing once read-only, then scan source, and name every file touched with its reason
- Reframe a vague ask as observable success criteria, carry each into the plan's verification, and ask when none can be predicted
- Slice by user-visible path with the riskiest batch first, and fold a stacked batch sharing most of its files into its parent unless the plan says why they differ
- Quote the fetched passage behind each outside source, mark an unfetched one unverified, and place each new path against the layout guidance with a one-clause reason
- Surface each ambiguity as a numbered question with a suggested answer and an empty slot, and stop at the plan

## Must not

- Implement, or edit any file the plan describes
- Read directories speculatively, since context spent on files the feature does not touch is context the plan does not get
- Run a form that writes to the tree being planned against, since a planner writes its plan and nothing else
- Bundle independent concerns into one plan
- Restate the plan in chat during follow-up rounds, since the file is the source of truth

## Out of scope

- Executing the plan, which `auto-ship` owns
- Creating a task for the plan, which `task-board` owns
- Reconciling the context entries after the work lands, which `context-fold` owns
- Marking the board, which `task-complete` owns
