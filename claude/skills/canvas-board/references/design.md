---
title: Design reference
description: Shape and content rules for canon/DESIGN.md
---

# Design reference

Applies to `canon/DESIGN.md`. Captures visual intent and the decisions behind how things look, not a style guide, component spec, or framework reference. Update when a visual decision is made or a rule changes.

## Contents

- [Scope](#scope)
- [Two shapes](#two-shapes)
- [What goes in](#what-goes-in)
- [What does not go in](#what-does-not-go-in)
- [Format](#format)
- [Prose budget](#prose-budget)
- [Sections](#sections)
- [The uncertainty tag](#the-uncertainty-tag)
- [Template](#template)

## Scope

Governs the visual-intent document at `canon/DESIGN.md`, being the rules and omissions that keep visual scope closed, the intent behind each role, and the pointer to where the values live.

Does not govern:

- Per-domain implementation narrative: `context.md`
- The token values themselves, which live in the project's stylesheet

## Two shapes

- **An intent record** is the shape a project writes by hand, carrying rules, omissions, and each role's intent, with a lead naming the stylesheet. It carries no value, since a hand-typed copy drifts.
- **A values record** is generated from a token source and carries value tables beside the rules. Never hand-edited, its lead names the module it renders from. The toolkit's own record is one.

Everything below applies to both shapes unless it names one.

## What goes in

- In the lead, the stylesheet a reader takes values from, such as `src/styles/tokens.css` or a Tailwind `@theme` block
- What each color role and each shape role is for, with the custom property that carries it
- Layout constraints and sizing rules not obvious from the stylesheet and the code
- Visual rules a developer could get wrong without guidance
- Non-obvious omissions ("no motion", "no custom icons") that prevent scope creep

## What does not go in

- A token's value in an intent record, whether a hex, a font stack, a size, a step, or a radius. The stylesheet the lead names carries it.
- CSS classes and prop names. Those live in code.
- Anything that needs updating every time the code is refactored
- The history of how a value or a mark was chosen, being the candidates, the rounds, and the date of a pick. State the rule and cut the trail, since version control keeps it.

## Format

- Write every rule as a short bullet, one decision per line, within `## Prose budget`.
- Plain English over technical notation. If a section could be removed and the developer would still build correctly from the stylesheet and code alone, remove it.
- Keep table headers and role names intact so the parser can read the tables.

## Prose budget

The record is a lookup, so its prose stays short enough to scan. Why a rule was chosen belongs in the project's context entry for design, never here.

- Overview: one paragraph of at most 60 words
- Any other section: at most 3 rules beside its table, each at most 25 words. A bullet is one rule, and so is a paragraph.
- The lead before the first section: at most 40 words

Headings and table rows are never counted, and a section holding a table and no rules is within budget. A bullet wrapping over several lines counts as one rule, and a nested bullet counts as its own.

## Sections

Use `## Overview`, `## Colors`, `## Typography`, `## Spacing`, `## Shapes`, `## Motion`, and `## Iconography`, in that order, which follows Google's DESIGN.md for the sections the two share.

- An optional `## Layout` sits between Spacing and Shapes
- The parser still reads the earlier names `## Personality`, `## Color`, and `## Borders` as the sections they became

In an intent record, `## Colors` carries a `Role | Property | Intent` table and `## Shapes` a `Role | Property | When used` table. Each row names the custom property the stylesheet declares for that role, such as `--color-accent`. Typography and Spacing carry rules alone.

Add either optional section when the project has content for it:

- `## Layout`: page width, breakpoints, and grid rules as current constraints. The surface-capture rule reads breakpoints here, so a project declaring none is captured at the 320 reflow floor alone.
- `## Mark`: the logo's construction rules and the files that carry it

## The uncertainty tag

Applies to a values record alone. An intent record carries no value to tag, and a guessed value is marked where it is written, in the stylesheet.

### Writing the tag

A cell no source anchors ends in ` ? verify`, written inside the cell rather than as a trailing column, since a trailing marker breaks the table parse. A cell wrapping itself in a code span carries the tag inside the span, as in `` `#ffffff ? verify` ``, and both spellings parse.

- The renderer splits the tag off the value, so a swatch and a font sample are built from the value alone and the marker shows beside it
- The preview reports anchored cells against tagged ones, which is where a reviewer reads the record's overall confidence

### Which columns count

The table fixes which columns the ratio reads, not the record. The first column names its row, and `Multiplier` and `When used` restate what the row carries, so no source could anchor them and none is counted.

| Section    | Counted columns                           |
| ---------- | ----------------------------------------- |
| Colors     | `Intent`, `Value`                         |
| Typography | `Family`, `Weight`, `Size`, `Line height` |
| Spacing    | `Value`                                   |
| Shapes     | `Radius`, `Width`                         |

A cell tagged outside that set counts anyway, so a marker the preview draws is never missing from the ratio beside it.

### Prose sections

A prose section takes its uncertainty inline instead, in a sentence saying what is proposed and what has yet to confirm it. A tag appended to a paragraph renders verbatim.

## Template

The template is the intent record. The column headers are read by exact key, so they stay verbatim. Row names are not, which leaves a project free to rename a role, add one, or drop one it has no use for.

```markdown
# Design

Values live in `<path to the stylesheet>`. This record holds the intent behind them.

## Overview

<one paragraph on voice, tone, and the feeling a user should have>

## Colors

- <a rule a developer could get wrong>

| Role   | Property         | Intent           |
| ------ | ---------------- | ---------------- |
| <role> | `--color-<role>` | <what it is for> |

## Typography

- <how the roles divide between families, and any role that breaks the pattern>

## Spacing

- <the base unit and how the scale steps>

## Shapes

- <a rule about radius or border a developer could get wrong>

| Role   | Property          | When used   |
| ------ | ----------------- | ----------- |
| <role> | `--radius-<role>` | <when used> |

## Motion

- <whether motion is used at all, and if so the default duration and easing>

## Iconography

- <style, source library, and whether custom icons are allowed>
```
