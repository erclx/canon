---
name: draft-figure
description: Drafts one hand-drawn figure for a document, deciding whether the subject is Mermaid-shaped, an architecture view, or needs freehand SVG, then draws it. Renders the Mermaid path through Mermaid's own hand-drawn look, reads the render back, and fixes what it exposes. Wraps every path in the figure standard's caption, color, and accessibility rules. Use when asked to "draw a figure", "add a hand-drawn diagram", "draft a figure for this doc", "draw this relationship as a figure", "draw the architecture", "diagram the system", or "show the components". Do NOT use for a UI wireframe, which is `draft-doc`, or for design tokens, which is `design-extract`.
metadata:
  family: generate
---

# Draft figure

Decide whether a requested figure reduces to a graph Mermaid can draw, is one of the architecture views, or needs freehand SVG, then draw it and verify what a reader will actually see.

## Guards

- If no subject is given, stop: `❌ No subject given. Name the relationship, boundary, path, or before-and-after this figure should show.`
- If no destination document is given, stop: `❌ No destination given. Name the file this figure belongs in.`

## Step 1: read sources

Read these in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/figures.md`: when a figure earns its place, the render-first policy, wrapping and captioning, and the color and accessibility rules
- `${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md`: formatting for the caption prose
- The `write-human` skill: voice and rhythm for the caption prose

## Step 2: does it earn its place

Apply the standard's bar: a relationship, a boundary, a path, or a before-and-after that prose or a list cannot carry as well. Stop when it does not: `❌ <subject> reads fine as prose. A figure adds nothing here.`

## Step 3: pick the path

Take the first that matches, and state which path was picked and why in one sentence:

1. **A teach lesson**, meaning the destination is a lesson page in a learning workspace's `lessons/` folder: the hand-drawn path, whatever the subject's shape, an architecture view included. The lesson letters its figures in a hand font the renderer cannot load, so a Mermaid render measures its labels in a narrower face and the lesson clips them.
2. **An architecture view**, meaning the request names system context, components, request flow, data pipeline, or deployment: the architecture set, then the Mermaid path.
3. **Graph-shaped**, meaning the relationship, boundary, or path is already what a flowchart or sequence diagram expresses: the Mermaid path.
4. **Anything else**, a spatial or physical arrangement no flowchart reduces to: the hand-drawn path.

The standard states this as a render-first policy rather than a ban on any tool-exported drawing, so outside a teach lesson a graph-shaped subject always routes through Mermaid even though that is itself an external renderer.

## Step 4: draw

Read the reference for the path Step 3 picked and follow it:

- Architecture set: read `${CLAUDE_SKILL_DIR}/references/architecture-set.md` to shape the view, then `${CLAUDE_SKILL_DIR}/references/mermaid.md` to draw and render it. The architecture branch always renders and reads back. An unrendered fence is not a figure.
- Mermaid path: read `${CLAUDE_SKILL_DIR}/references/mermaid.md`.
- Hand-drawn path: read `${CLAUDE_SKILL_DIR}/references/hand-drawn.md`.

## Step 5: wrap, caption, and verify

- Wrap the drawing in a `<figure>` element with a `<figcaption>` naming what to take from the figure, never what it shows. Let it run wider than the surrounding prose column.
- On the Mermaid path, run the read-back `mermaid.md` states before confirming.
- On every path, confirm the figure still reads once every color and font it depends on is stripped to its fallback, per the standard's own working-figure bar.
- When the destination is a rendered page, an HTML file a browser loads, the check that counts is the figure inside that page, which Step 6 captures once the figure is written, on either path. A markdown destination has no page to load, so the checks above are the whole check there.

## Step 6: confirm and write

Show the destination path, the decided path, and the full `<figure>` markup before writing. Confirm with the user, since the path decision and the render verdict are judgment calls with no diff to preview either against.

Write the figure into the destination document at the location the user named.

When the destination is a rendered page, read the `## Capture in the page` section of `${CLAUDE_SKILL_DIR}/references/hand-drawn.md` and run it, on the Mermaid path as well as the hand-drawn one, within the same two correction passes the read-back allows.

Renders and captures under `.canon/tmp/figures/` are verification artifacts, and the scratch PNGs, the stamps the capture writes beside them, and the JSON config are deleted once the checks confirm, since only the SVG ships. Keep the `.mmd` source, which is what a later refresh redraws from.

## Output

### Preview

**Destination:** `<path>`
**Render path:** `<mermaid | architecture | freehand>`, `<one-sentence reason>`

```html
<drafted figure markup></drafted>
```

### After confirmation

```plaintext
✅ Drafted figure in <path>
Render path: <mermaid | architecture | freehand>
Verified <in page | as a standalone render>. <defect or skipped check, one line, omitted when clean>
<Font not embedded: run `canon design css --figures` to ship Virgil and Excalifont. Omitted when the project already ran it.>
```
