---
name: draft-slides
description: Draws a deck as HTML slides in the project's own design, one folder under `.canon/slides/` per deck, then renders it to an editable PowerPoint file via `canon slides render`. Use when asked to "draft slides", "make a deck", "build a presentation", "turn this into slides", or "render the deck". Holds the deck design rules. Do NOT reimplement the conversion. The CLI owns layout into PowerPoint shapes, the master, and packaging. Assumes the `canon` CLI is on PATH.
metadata:
  family: generate
---

# Draft slides

Draw each slide as an HTML file in a deck folder, then shell out to `canon slides render`. The CLI lays every slide out in a browser and rebuilds it as editable PowerPoint shapes. This skill owns the content, the slide markup, and the design choices the markup encodes.

## Read the decks and the format

Run both first. Never hardcode a deck name, an attribute, or a chart type. The CLI is the source of truth for each.

```bash
canon slides list --json 2>/dev/null
canon docs slides
```

The list returns one row per deck, carrying its `name`, `title`, slide count, and `path`. When the request names a deck the list holds, edit that folder. Otherwise pick a new kebab-case name no row carries.

The docs page states what `deck.json` holds, what each slide declares on its `<body>`, the motion attributes, speaker notes, charts, and what each refusal reports.

## Draw the deck

A deck folder sits at `.canon/slides/<deck>/` from the project root, and holds:

- One `.html` file per slide, rendered in filename order. Number them with a zero-padded prefix, such as `01-cover.html`, so a slide inserted later sorts where it belongs.
- `deck.json`, optional, for the title, the header and footer bands, slide numbers, the mark, and embedded faces.
- `assets/` for images the slides reference by a relative path.

Never write a slide into `.canon/slides/layouts/`. That folder holds the project's shared layouts and is never listed as a deck.

Each slide is a full HTML document laid out at 1280 by 720 CSS pixels. Position its blocks absolutely or with a flex or grid container sized to that frame, and keep every element inside it.

## Design rules

The render injects the project's token stylesheet ahead of each slide's own styles, so the deck takes the project's design rather than the toolkit's.

- Use the project's custom properties, such as `var(--color-accent)`, for every color, face, and spacing value the stylesheet defines. Read the names from `.claude/design/base.css` and any overrides under `.claude/design/project/`. When neither exists, say the deck renders unstyled rather than inventing values to cover it.
- Leave the `--color-*` roles to the stylesheet rather than redefining them in a slide. The master reads its colors off the first slide's `<html>`, and a slide body computing its own `--color-text` is reported, since the bands keep the master's colors.
- Vary the composition across slides. Never repeat a title over bullets on every slide. Reach for columns, a row of large numbers, a grid of cards, a chart, a pull quote, and section dividers.
- Keep titles short and lines tight, so text fits its box at the size the design sets rather than overflowing the frame.
- Never write centered body text.
- Prefer CSS the converter maps to native shapes. An element computing a property it cannot map is drawn as a picture of itself and reported on stderr, so a slide full of gradients and filters stops being editable.

## Render

Shell out to the CLI. It writes the deck and reports the path.

```bash
canon slides render <deck>
```

With one deck in the project the name can be left out. The render refuses with the deck list when there are several. Pass `--open` to open the deck, and `--mirror <dir>`, or set `CANON_SLIDES_MIRROR`, to copy it into a synced folder.

Read every `✗` line the render prints. A picture fallback, a refused link, chart, or effect, and a missing token each leave the deck written with that piece degraded or left out.

## QA loop

Run this once after the first render, then stop.

1. Convert the deck to images: `soffice --headless --convert-to pdf <deck>.pptx` then `pdftoppm -r 90 -png <deck>.pdf slide`. If `soffice` or `pdftoppm` is missing, skip the image pass and say so. Do not fail the render.
2. Open and inspect every rendered image in this session, checking each slide for overlap, overflow, low contrast, and empty regions.
3. Fix the reported issues and the `✗` lines in the slide files once, re-render, and stop. Do not loop indefinitely on aesthetics.

## Response

After rendering, report:

- The deck folder, the slide count, and the written `.pptx` path
- Whether the project's token stylesheet was found
- Each `✗` line the final render printed, or that it printed none
- Any QA issues found and what changed, or that the deck passed clean
