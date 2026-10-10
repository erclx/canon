---
title: Hand-drawn path
description: Authoring a freehand SVG, its color and accessibility audit, and the in-page capture loop a rendered destination takes, read by draft-figure once a figure is drawn by hand
---

# Hand-drawn path

`draft-figure` reads this file when Step 3 routes a figure to a freehand drawing: a teach lesson whatever its subject, or a subject no flowchart reduces to.

## Draw

- Author the SVG by hand: plain shapes and lines authored directly in the markup.
- Follow the `## Color and accessibility` section of `${CLAUDE_SKILL_DIR}/../../standards/figures.md` for every fill, stroke, and accessible name.

There is no external render to verify a freehand drawing against before it is written. The check here is the stroke-and-fill audit above and a read of the markup against what the subject means to show, done once rather than looped. Hand-placed coordinates can drift out of line where a layout engine would not, so a freehand figure bound for a rendered page also takes the in-page capture below.

## Capture in the page

When the destination is a rendered page, an HTML file a browser loads, capture the figure inside it once it is written and read the capture against what the figure means to say:

```bash
canon capture <destination> --selector figure --out .canon/tmp/figures/
```

- Narrow the selector to this figure, such as by an id on its `<figure>`, when the page carries more than one.
- Fix a clipped label, a misaligned shape, or an arrow that misses its target in the destination and capture again. Stop after two correction passes.
- When the capture fails, keep the figure and name the skipped check in the output.

A Mermaid figure bound for a rendered page takes this same capture, since its standalone PNG is measured in the renderer's own fonts and can read clean while the page clips it. A clipped group title there takes the scoped overflow style `${CLAUDE_SKILL_DIR}/references/mermaid-path.md` states.

A markdown destination has no page to load, so the read of the markup, or of the standalone render on the Mermaid path, is the whole check there.
