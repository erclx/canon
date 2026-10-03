---
title: Requirements reference
description: Shape and content rules for canon/REQUIREMENTS.md
---

# Requirements reference

Applies to `canon/REQUIREMENTS.md`. Describes what the product does and why, not how it works. Update when scope changes, goals shift, or a non-goal is promoted to a feature.

## Scope

Governs the product-scope document at `canon/REQUIREMENTS.md`: problem, goals, non-goals, MVP features, distribution, and constraints.

Does not govern:

- Rationale for a technical choice: `architecture.md`
- Execution order across the work the scope generates: `board.md`
- Per-domain structure and narrative: `context.md`

## What goes in

- The problem being solved and for whom
- User-facing goals stated as outcomes, not implementation
- Explicit non-goals that prevent feature creep. Mark deferred items "(deferred)" so they read as paused, not excluded. A non-goal resting on how an outside tool, an installer, or the model behaves may close with one `Revisit when <finding>.` sentence, and a non-goal resting on scope alone takes none.
- MVP features as a numbered list: feature name and one-line description
- Hard constraints that shape every decision

## What does not go in

- Implementation details, API names, or internal component references
- Anything that describes how a feature is built rather than what it does
- Measured results, such as scores, benchmark figures, or token counts. They move on every run and this file changes least. Name where the results live instead.
- Content another canonical doc owns, such as the stack list, which the stack-and-runtime slot of `canon/ARCHITECTURE.md` holds, or the rules of this standard itself

## Sections

Use `## Problem`, `## Goals`, `## Non-goals`, `## MVP features`, and `## Constraints`. Add `## Distribution` when the rule below applies. Add `## Worldview` when the project holds beliefs that shape every decision, and keep a belief there only when it changes a decision, since a padded worldview turns into a second goals list. Add `## Premise` when the project exists to answer a question, stated as the question and what would count as an answer, never as the answer measured so far. Drop a section rather than pad it with filler.

## Length

This file loads into every session, so its weight is paid before any work starts. Cap it by stating the clause `This record holds at most <n> words.` in the record itself, where a checker reads it and counts every word below the frontmatter. The cap is the record's own, so a record stating none is measured and never gated. Set it near 600, and at the cap cut a goal or a constraint that no longer changes a decision before adding one.

## Lifecycle

Once every entry in the MVP list, or in a later scope section, has shipped, delete the section. Git keeps the old text, and the document states the project as it stands. Do not annotate an entry as shipped and leave it in place. While any entry is unshipped, do not renumber the list or append to it.

Later scope arrives as a new section rather than as an extension of the MVP list. Name the section for what it delivers and state its entries as outcomes, the same way the goals are stated. Nothing sequences either list into versions. Work reaches the board as discrete tasks under `tasks.md`, and `board.md` orders them by readiness, so a section here states what is wanted and never when it lands.

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

## Constraints
```
