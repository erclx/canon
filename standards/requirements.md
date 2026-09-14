---
title: Requirements reference
description: Shape and content rules for canon/REQUIREMENTS.md
---

# Requirements reference

Applies to `canon/REQUIREMENTS.md`. Describes what the product does and why, not how it works. Update when scope changes, goals shift, or a non-goal is promoted to a feature.

## Scope

Governs the product-scope document at `canon/REQUIREMENTS.md`: problem, goals, non-goals, MVP features, distribution, stack, and constraints.

Does not govern:

- Rationale for a technical choice: `architecture.md`
- Execution order across the work the scope generates: `tasks.md`
- Per-domain structure and narrative: `context.md`

## What goes in

- The problem being solved and for whom
- User-facing goals stated as outcomes, not implementation
- Explicit non-goals that prevent feature creep. Mark deferred items "(deferred)" so they read as paused, not excluded.
- MVP features as a numbered list: feature name and one-line description
- Tech stack as a plain list of tools
- Hard constraints that shape every decision

## What does not go in

- Implementation details, API names, or internal component references
- Anything that describes how a feature is built rather than what it does
- Measured results, such as scores, benchmark figures, or token counts. They move on every run and this file changes least. Name where the results live instead.

## Sections

Use `## Problem`, `## Goals`, `## Non-goals`, `## MVP features`, `## Tech stack`, and `## Constraints`. Add `## Distribution` when the rule below applies. Add `## Premise` when the project exists to answer a question, stated as the question and what would count as an answer, never as the answer measured so far. Drop a section rather than pad it with filler.

## Lifecycle

The MVP list is a historical record of the original scope. Once those features ship it stays as written. Do not renumber it, do not append to it, and do not annotate entries with status. A reader telling the original scope apart from what followed depends on the first one staying legible.

Later scope arrives as a new section rather than as an extension of the MVP list. Name the section for what it delivers and state its entries as outcomes, the same way the goals are stated. Nothing sequences either list into versions. Work reaches the board as discrete tasks under `tasks.md`, which orders them by readiness, so a section here states what is wanted and never when it lands.

## Distribution

Include `## Distribution` only when the project ships to consumers outside its own repository. An internal service or a monorepo application has nothing to put in it, and a section every project is told to fill is one most projects pad. Place it after `## MVP features`.

State each entry as an outcome the consumer reaches, never as the mechanism that delivers it. A registry name, a manifest format, a version scheme, or a release tool is implementation and belongs in `canon/ARCHITECTURE.md`. Distribution pulls harder toward mechanism than any other section, which is why the rule is repeated here.

## Template

```markdown
# Requirements

## Problem

## Goals

## Non-goals

## MVP features

1. Feature: description

<!-- ## Distribution: include only when shipping outside the repository -->

## Tech stack

## Constraints
```
