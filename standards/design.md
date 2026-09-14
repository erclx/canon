---
title: Design reference
description: Shape and content rules for canon/DESIGN.md
---

# Design reference

Applies to `canon/DESIGN.md`. Captures visual intent and the decisions behind how things look, not a style guide, component spec, or framework reference. Update when a visual decision is made or a rule changes.

## Scope

Governs the visual-intent document at `canon/DESIGN.md`: tokens described as intent, layout constraints, and the omissions that keep visual scope closed.

Does not govern:

- Screen layout, on-screen copy, and interaction intent: `wireframes.md`
- Per-domain implementation narrative: `context.md`

## What goes in

- A token's exact value, anchored to the surface it was read from and tagged per `## The uncertainty tag` when unconfirmed. Fall back to intent language ("mid gray, muted text") only where no source exists yet to anchor from.
- Layout constraints and sizing rules not obvious from wireframes
- Visual rules a developer could get wrong without guidance
- Non-obvious omissions ("no motion", "no custom icons") that prevent scope creep

## What does not go in

- CSS classes and prop names. Those live in code.
- Anything that needs updating every time the code is refactored
- The history of how a value or a mark was chosen: the candidates, the rounds, the date of a pick. State the rule and the current value. The trail goes to the decision log.

## Format

- Use tables for token systems, one row per token. Use short bullets for component rules, one decision per line.
- Plain English over technical notation. If a section could be removed and the developer would still build correctly from wireframes and code alone, remove it.
- Keep table headers and role names intact so the render tooling can parse the token tables.

## The uncertainty tag

A cell no source anchors ends in ` ? verify`, written inside the cell rather than as a trailing column, since a trailing marker breaks the table parse. A cell wrapping itself in a code span carries the tag inside the span, as in `` `#ffffff ? verify` ``. Both spellings parse.

The renderer splits the tag off the value, so a swatch and a font sample are built from the value alone and the marker shows beside it. The preview also reports how many cells are anchored against how many are tagged, which is the reading a reviewer takes the record's overall confidence from.

Which columns that ratio reads is fixed by the table rather than by the record. The first column of each table names its row, and `Multiplier` and `When used` restate what the row already carries, so none of them is something a source could anchor and none is counted. That leaves `Intent` and `Value` in Color, `Family`, `Weight`, `Size`, and `Line height` in Typography, `Value` in Spacing, and `Radius` and `Width` in Borders. A cell tagged outside that set counts anyway, so a marker the preview draws is never missing from the ratio beside it.

A prose section takes its uncertainty inline instead, in a sentence saying what is proposed and what has yet to confirm it. A tag appended to a paragraph renders verbatim.

## Sections

Use `## Personality`, `## Color`, `## Typography`, `## Spacing`, `## Borders`, `## Motion`, and `## Iconography`. The token tables carry fixed headers the renderer reads.

Add either optional section when the project has content for it:

- `## Layout`: page width, breakpoints, and grid rules, as current constraints
- `## Mark`: the logo's construction rules and the files that carry it

## Template

The column headers are the strings the renderer parses, read by exact key, so they stay verbatim. Row names are not. Each is slugged into the variable name it emits, which leaves a project free to rename a row, add one, or drop one it has no use for.

```markdown
# Design

## Personality

<one paragraph on voice, tone, and the feeling a user should have>

## Color

| Role   | Intent           | Value   |
| ------ | ---------------- | ------- |
| <role> | <what it is for> | <value> |

## Typography

| Role   | Family   | Weight   | Size   | Line height |
| ------ | -------- | -------- | ------ | ----------- |
| <role> | <family> | <weight> | <size> | <height>    |

## Spacing

| Step   | Multiplier   | Value   |
| ------ | ------------ | ------- |
| <step> | <multiplier> | <value> |

## Borders

| Role   | Radius   | Width   | When used   |
| ------ | -------- | ------- | ----------- |
| <role> | <radius> | <width> | <when used> |

## Motion

<whether motion is used at all, and if so the default duration and easing>

## Iconography

<style, source library, and whether custom icons are allowed>
```
