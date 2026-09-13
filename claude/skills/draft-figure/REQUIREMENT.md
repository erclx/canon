---
name: draft-figure
description: Why a figure decides between Mermaid and freehand SVG before drawing, and why only the Mermaid path carries a render-verification loop
---

# Draft figure requirement

## Gap

Without this skill, a session asked for a figure reaches for whichever path it thought of first. A graph-shaped subject gets model-authored SVG coordinates nobody checked against a render, drifting from the hand-drawn look every other figure in the project carries. A subject that is not graph-shaped gets forced through Mermaid's node-and-edge model, producing a diagram that answers a different question than the one asked. Either failure ships a figure a reader cannot trust, and a figure exists only to be trusted at a glance.

The color failure is the quiet one. Mermaid's own theme writes literal hex values, and a figure carrying one stops re-coloring itself the moment the host page switches its palette, which the figure standard's own accessibility bar rules out.

## Must

- Apply the standard's earn-its-place bar before drawing anything
- Decide between the Mermaid path and the freehand path by whether the subject reduces to a graph, not by which is faster to produce
- Render the Mermaid path with the hand-drawn look and the figure font stack, never with Mermaid's default look
- Rewrite every literal color the renderer wrote into the custom property the host stylesheet defines
- Read the Mermaid render back and judge it against what the figure means to say, the same verification `draft-diagram` runs for the architecture surface
- Wrap either path in a `<figure>` and `<figcaption>` and give it an accessible name

## Must not

- Force a non-graph-shaped subject through Mermaid, or route a graph-shaped one through freehand SVG coordinates a model authored by hand
- Ship a literal hex color on either path
- Report a clean verification when the Mermaid render was skipped or a defect survived
- Loop past two correction passes on a surviving defect
- Commit a scratch render. Only the SVG that ships in the destination document survives

## Guards

- No subject given: stop, since nothing states what the figure has to show
- No destination document given: stop, since the figure has nowhere to land
- Subject does not clear the earn-its-place bar: stop rather than drawing decoration

## Out of scope

- The toolkit's own `.canon/diagrams/` architecture surface, which shares no code, font, or visual language with this convention: `draft-diagram`
- Mermaid's own layout, budgets, and label rules for the fence itself: the mermaid standard, cited rather than restated here
- A UI wireframe or screen mockup: `draft-wireframes`
- `teach-workspace`'s own lesson-figure authoring, which stays inline rather than calling this skill
