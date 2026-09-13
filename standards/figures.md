---
title: Figure reference
description: When a figure earns its place, the render-first policy for a graph-shaped subject, freehand SVG as the escape hatch, and its wrapping, color, and accessibility rules
---

# Figure reference

Applies to every hand-drawn figure, wherever it is authored. A figure sits inside a document some other standard shapes, so this file reaches the figure and stops at its closing `</figure>` tag.

## Scope

Governs a hand-drawn figure wherever one is authored, naming no path because an attribute standard governs a fragment rather than a document type: when it earns its place, the render-first policy routing a graph-shaped subject through Mermaid, the wrapping and caption every figure carries, and its color and accessibility rules. It carries no template, since a figure has no document shape of its own and sits inside one another standard sets.

Does not govern:

- Direction, layout, node and edge budgets, labels, and render verification for the Mermaid path: `mermaid.md`
- The toolkit's own architecture-diagram surface at `.canon/diagrams/`, which shares no code, font, or visual language with this convention: `diagrams.md`
- Language, word choice, punctuation, and formatting in the caption or surrounding prose: `markdown.md`
- Voice, rhythm, and sentence construction in that prose: the `write-human` skill
- Which document types may carry a figure, and what else they require: that document type's own standard

## What a working figure looks like

A figure works when a reader who cannot see it still gets what it was for, and one who can see it gets nothing a well-placed sentence could not carry:

- Does the subject clear the bar: a relationship, a boundary, a path, or a before-and-after that prose or a list cannot carry as well?
- Does the caption name what to take from the figure rather than what it shows?
- Does the figure still read after every color and font it depends on is stripped to its fallback?

A figure failing these is non-conforming even when it satisfies every shape rule below.

## When a figure earns its place

- Draw a figure only when a relationship, a boundary, a path, or a before-and-after is the point of the passage rather than decoration for it. Most passages do not clear that bar.
- Leave the point in prose or a list when it already carries there. A figure reaching for every passage repeats the failure restraint already guards against elsewhere in the document.

## The render-first policy

- Route a graph-shaped subject, one whose relationship, boundary, or path a flowchart already expresses, through Mermaid's own hand-drawn look rather than through model-authored SVG coordinates. `mermaid.md` governs the fence itself.
- Reserve freehand inline SVG, plain shapes and lines authored directly in the markup, for a subject that is not graph-shaped. A figure that cannot express its subject through the deterministic path is a worse failure than an inconsistent one drawn by hand, so the hatch stays open rather than forcing every figure through the renderer.
- State this as a render-first policy rather than a ban on a tool-exported drawing. Routing a graph-shaped figure through Mermaid is itself running it through an external tool, so a rule banning any diagram "exported from a diagramming tool" would forbid the path this policy requires.

## Wrapping and captioning

- Wrap a figure in a `<figure>` element holding its drawing and a `<figcaption>` that names what to take from the figure rather than what it shows.
- Let the figure run wider than the surrounding prose column. A figure cramped to the reading measure loses the labels it needs.

## Color and accessibility

- Color every fill and stroke through a custom property the surrounding document's own stylesheet defines, never a literal hex value. The figure then re-colors itself on the same switch that re-colors the page.
- Give the drawing an accessible name: `role="img"` with `aria-label` for one short line, or `aria-labelledby` pointing at a `<title>` element inside it for a longer one.
