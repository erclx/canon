---
description: Route edits that decide how a surface looks to the design-taste skill for the layer ordering, the coherence locks, and the defaults a model reaches for
paths:
  - '**/*.css'
  - '**/*.scss'
  - 'canon/DESIGN.md'
---

# Design taste standards

## Authority

- Load the `canon:design-taste` skill for which design decision settles first, what must stay constant across a surface, and the defaults to reach past. It is the single source for all three.
- Load it before drafting, not after revising. A revision recovers a color and never recovers the composition a draft already settled.
- Report it rather than proceeding silently when the skill does not resolve. It ships with the plugin and this rule ships with the CLI, so a project that installed governance alone does not have it.
- Do not work the layer ordering or the coherence locks from memory.

## When this fires and when it does not

- This rule scopes to the files where an undecided visual choice lands, which is the stylesheet and the design document. Building a surface somebody already decided is implementation rather than design, and the rules below carry what implementation owes.
- Load the skill by name when a component edit makes a visual choice nobody has taken yet, such as a new section's shape, a spacing relationship, or a radius. The glob cannot see that intent and no glob can.
- Do not load it to ship a decided design. A worker wiring a picked composition pays the read and gets nothing back.

## Boundaries

- Accessibility, keyboard interaction and ARIA are a separate topic. `410-a11y` routes them, on every rendered path.
- States, empty and loading coverage, and destructive confirmation are a separate topic. `430-ux-completeness` routes them.
- Rendered copy casing is a separate topic. `465-interface-casing` routes it. Button labels and error wording are separate too, and `400-ui` routes them.
- The floor those three carry is not restated in the skill, and it is not traded against a preference where the two collide.
