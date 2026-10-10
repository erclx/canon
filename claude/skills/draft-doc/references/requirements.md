---
title: Requirements reference
description: Shape and content rules for canon/REQUIREMENTS.md
---

# Requirements reference

Applies to `canon/REQUIREMENTS.md`. Describes what the product does and why, not how it works. Update when scope changes, goals shift, or a non-goal is promoted to a feature.

## Scope

Governs the product-scope document at `canon/REQUIREMENTS.md`: goals and non-goals, with constraints and worldview when the project has them.

Does not govern:

- Rationale for a technical choice: `architecture.md`
- Execution order across the work the scope generates: `board.md`
- Per-domain structure and narrative: `context.md`

## What goes in

- The problem being solved and for whom, as the record's opening line under the title
- User-facing goals stated as outcomes, not implementation
- Explicit non-goals that prevent feature creep. Mark deferred items "(deferred)" so they read as paused, not excluded. A non-goal resting on how an outside tool, an installer, or the model behaves may close with one `Revisit when <finding>.` sentence, and a non-goal resting on scope alone takes none.
- Hard constraints that shape every decision, when the project has any

## What does not go in

- Implementation details, API names, or internal component references
- Anything that describes how a feature is built rather than what it does
- Measured results, such as scores, benchmark figures, or token counts. They move on every run and this file changes least. Name where the results live instead.
- Content another canonical doc owns, such as the stack list, which the stack-and-runtime slot of `canon/ARCHITECTURE.md` holds, or the rules of this standard itself

## Sections

Require `## Goals` and `## Non-goals`. Add `## Constraints` when the project holds hard limits that shape every decision. Add `## Worldview` when the project holds beliefs that shape every decision, and keep a belief there only when it changes a decision, since a padded worldview turns into a second goals list. Drop a section rather than pad it with filler.

## Length

This file loads into every session, so its weight is paid before any work starts. Cap it by stating the clause `This record holds at most <n> words.` in the record itself, where a checker reads it and counts every word below the frontmatter. The cap is the record's own, so a record stating none is measured and never gated. The template and the seed a new project installs state it at 600, and a project loosens it by editing the number in its own record. At the cap, cut a goal or a constraint that no longer changes a decision before adding one.

## Lifecycle

The record may carry an optional `reviewed: YYYY-MM-DD` frontmatter field naming the day someone last read it whole for identity drift. Whoever finishes that review sets it as the review's last edit, and `canon records stale canonical` reads it to count the releases shipped since. A record with no field reads as never reviewed.

Later scope arrives as a new section rather than as an extension of the goals. Name the section for what it delivers and state its entries as outcomes, the same way the goals are stated. Once every entry in it has shipped, delete the section, since version history keeps the old text and the document states the project as it stands. Nothing sequences a section into versions. Work reaches the board as discrete tasks under `tasks.md`, and `board.md` orders them by readiness, so a section here states what is wanted and never when it lands.

## Template

```markdown
# Requirements

[One line: the problem and who has it]

This record holds at most 600 words.

## Goals

## Non-goals

<!-- ## Constraints: include only when hard limits shape every decision -->
```
