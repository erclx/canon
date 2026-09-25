---
name: plan-feature
description: What feature planning is for, the gaps it closes, and why it stops before implementing
---

# Plan feature requirement

## Gap

Without this skill, implementation starts before anyone knows what it touches. A session reads no project context and rediscovers a settled constraint halfway through, the file list emerges as the work goes rather than before it, and the ambiguities that needed a decision get resolved silently in whichever direction the first edit happened to go. A constraint naming a surface to leave alone forbids two different acts at once, so the executing session picks one and the branch either grows an excluded concern or ships a reference to a file the change deleted.

## Must

- Read the project's own Claude setup before scanning source, so the plan inherits decisions already made instead of reopening them
- Name every file the work touches with the reason it is touched
- Place each new path against the layout guidance with a one-clause reason, loading that guidance only when the plan creates a file or folder, since the planner decides placement and the worker copies whatever path it is given
- Name how each outcome is proven and which input or state would break the change, so the executing session has a check to run and the reviewer has a place to look
- Surface each unresolved ambiguity as a numbered question carrying a suggested answer and an empty answer slot, so the plan is decision-ready in one pass
- State which act a constraint forbids when it names a surface to leave alone, since conforming that surface and retargeting a pointer into it are different acts and only one is out of scope
- Scale the output to the work. A two-file change with nothing to decide should not produce a plan file.
- Stop at the plan and wait to be told to continue

## Must not

- Implement, or edit any file the plan describes
- Read directories speculatively. Context spent on files the feature does not touch is context the plan does not get.
- Bundle independent concerns into one plan, since a plan covering two things gets executed as neither
- Restate the plan in chat during follow-up rounds. The file is the source of truth and a chat copy of it goes stale immediately.

## Guards

- No feature description: stop and ask for one

## Out of scope

- Executing the plan, which is the ship pipeline
- Task-board state, which `task-board` owns. A plan links to its task and does not create one.
- Reconciling the planning docs after the work lands, which `docs-fold` owns
