---
name: draft-figure
description: Why a figure decides between Mermaid, an architecture view, and freehand SVG before drawing, and why the Mermaid path carries a render-verification loop
---

# Draft figure requirement

## Gap

Without this skill, a session asked for a figure reaches for whichever path it thought of first. A graph-shaped subject gets model-authored SVG coordinates nobody checked against a render, drifting from the hand-drawn look every other figure in the project carries. A subject that is not graph-shaped gets forced through Mermaid's node-and-edge model, producing a diagram that answers a different question than the one asked. Either failure ships a figure a reader cannot trust, and a figure exists only to be trusted at a glance.

A teach lesson breaks the Mermaid path outright. The lesson letters its figures in a hand font the renderer cannot load, so the render sizes every label in a narrower fallback face and the lesson clips the text it actually shows. The check then reads the standalone image, rendered in that same fallback, and passes a figure the reader sees clipped. Both happened on one lesson, where every group title clipped mid-word and only a capture taken inside the lesson showed it.

An architecture view asked for one at a time fails its own way. A session asked to refresh one view redraws every view beside it, so pictures nobody checked change in the same commit and the reviewer cannot tell which one the pass was about. It reaches for C4, state, or class diagrams that render differently in every viewer. A Mermaid source can satisfy every rule in the standard and still render as a picture asserting something false about the system, so a session that judges the source and calls it verified has spent the only signal a reader has on a picture nobody looked at.

The color failure is the quiet one. Mermaid's own theme writes literal hex values, and a figure carrying one stops re-coloring itself the moment the host page switches its palette, which the figure standard's own accessibility bar rules out.

## Must

- Apply the standard's earn-its-place bar before drawing anything
- Decide between the Mermaid path and the freehand path by whether the subject reduces to a graph, not by which is faster to produce
- Draw an architecture view from its named source signal, inside `flowchart` and `sequenceDiagram`, and render it through the Mermaid path
- Draw only the view the request names, leaving every other figure in the destination untouched
- Draw a figure bound for a teach lesson freehand whatever its shape, since the lesson's hand font is one the renderer cannot measure
- Verify a figure bound for a rendered page by capturing it inside that page, and fall back to the standalone render only where the destination has no page to load
- Keep the scoped overflow style as the documented fallback for a clipped group title wherever the Mermaid path still runs
- Render the Mermaid path with the hand-drawn look and the figure font stack, never with Mermaid's default look
- Rewrite every literal color the renderer wrote into the custom property the host stylesheet defines
- Read the Mermaid render back and judge it against what the figure means to say, rather than judging the source
- Read the node labels by hand, since no hook checks inside a fence
- Cite only code paths that exist in an architecture view's caption or prose
- Wrap either path in a `<figure>` and `<figcaption>` and give it an accessible name

## Must not

- Force a non-graph-shaped subject through Mermaid, or route a graph-shaped one through freehand SVG coordinates a model authored by hand outside a teach lesson
- Report a figure bound for a rendered page as verified from the standalone render alone
- Ship a literal hex color on either path
- Report a clean verification when the Mermaid render was skipped or a defect survived
- Loop past two correction passes on a surviving defect
- Commit a scratch render. Only the SVG that ships in the destination document survives
- Redraw a figure the request did not name, or report one as drawn when it was left alone
- Leave an architecture view as an unrendered fence

## Guards

- No subject given: stop, since nothing states what the figure has to show
- No destination document given: stop, since the figure has nowhere to land
- Subject does not clear the earn-its-place bar: stop rather than drawing decoration
- An architecture view with no planning file and no folder structure to scan: stop, because nothing anchors it
- Render fails for any reason: continue to the output and name the skipped check. A missing renderer degrades the loop rather than failing it.

## Out of scope

- Mermaid's own layout, budgets, and label rules for the fence itself: the mermaid standard, cited rather than restated here
- A UI wireframe or screen mockup: `draft-doc`
- Design tokens and the visual system: `design-extract`
- Implementation detail behind an architecture view, which belongs in a context entry the caption points at
- Which lesson needs a figure and where it sits among the lesson's blocks: `teach-workspace`, which calls this skill to draw one
