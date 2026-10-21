---
name: draw-figure
description: Why a figure decides between Mermaid, an architecture view, and freehand SVG before drawing, and why the Mermaid path carries a render-verification loop
---

# Draw figure requirement

## Gap

Without this skill, a session asked for a figure takes the first path it thinks of. A graph gets SVG coordinates nobody checked against a render, and a subject that is not a graph gets forced through Mermaid.

Asked to refresh one architecture view, it redraws every view beside it. It judges the source and calls the figure verified, though a valid source can render a picture asserting something false. Mermaid's theme writes literal hex values, so the figure stops re-coloring when the page switches palette.

## Must

- The figure clears the standard's earn-its-place bar, and its path follows whether the subject reduces to a graph
- An architecture view is drawn from its named source signal in `flowchart` or `sequenceDiagram`, and only the view the request names changes
- The Mermaid render uses the hand-drawn look and the figure font stack, with every literal color rewritten to the host's custom property
- The render is read back against what the figure means to say, and a figure bound for a rendered page is verified by a capture inside that page
- Either path lands in a `<figure>` with a `<figcaption>` and an accessible name, and an architecture view's caption cites only code paths that exist

## Must not

- Draw with no subject or no destination, an architecture view with no planning file or folder structure to anchor it, or decoration for a subject that fails the bar
- Report a figure verified from the standalone render alone, or report a clean check when the render was skipped or a defect survived
- Ship a literal hex color, or commit a scratch render
- Loop past two correction passes on a surviving defect
- Redraw a figure the request did not name, or leave an architecture view as an unrendered fence

## Out of scope

- Mermaid's layout, budgets, and label rules inside the fence, which the mermaid standard owns
- A UI screen mockup, and design tokens or the visual system, which `canvas-board` owns
- Implementation detail behind an architecture view, which the context entry the caption points at owns
