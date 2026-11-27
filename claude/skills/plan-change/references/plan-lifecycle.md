---
title: Plan lifecycle reference
description: When a feature plan is written, where it lives, how it changes mid-flight, and its move to the archive
---

# Plan lifecycle reference

Applies to a feature plan at `.canon/plans/feature-<slug>.md` from the session that writes it to the archive. The folder is gitignored, so nothing but this lifecycle keeps a plan's rejected alternatives readable after the work ships.

This standard governs when a plan moves and changes rather than what the file holds, so it carries no template. The plan's own template is in `plan.md`.

## Scope

Governs when a feature plan is written, where it lives across working trees, how it is amended, and its move to `.canon/plans/archive/`.

Does not govern:

- The filename, the required sections, and the suggested-and-answer contract: `plan.md`
- The task file a plan is linked from, and how it is archived: `tasks.md`

## What a working lifecycle looks like

A plan's lifecycle works when a later reader can still answer, from the file alone:

- What did the work set out to do, and which alternative did it reject?
- Which answer to each question is current, without reconciling two passages?

A plan lost to deletion, or carrying two answers to one question, fails both.

## Lifecycle

- Write the plan before implementation starts, and treat it as the scope of the run that executes it. A subject that has to be measured before anyone can plan against it takes a measurement track first.
- Write the plan in the same session that opens the task it serves. The session executing it later inherits reasoning it would otherwise re-derive.
- Keep every plan at one root. A plan copied into each parallel working tree forks, and the copies answer the same question differently.

### Amending and archiving

A plan changes in place and leaves only by a move.

- Amend the plan in place when a decision changes mid-flight, never appending a passage narrating the change, which leaves two answers to reconcile
- An execution-time deviation from a suggestion is one such amendment, and the suggested-and-answer contract in `plan.md` fixes which line takes it
- Move the plan to `.canon/plans/archive/` when its work ships or is declined, and never delete it, since it records the rejected alternative
- A flat `.claude/plans-archive/` sibling is the older layout.
